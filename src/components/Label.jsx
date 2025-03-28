import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { imageDb, firestoreDb } from "../firebase/firebaseConfig";
import {
  listAll,
  ref,
  getDownloadURL,
  deleteObject,
  getMetadata,
  uploadBytes,
  updateMetadata,
} from "firebase/storage";
import {
  doc,
  // getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import CropComponent from "./CropComponent";
// import { AiTwotoneDelete } from "react-icons/ai";
import { RiDeleteBinLine } from "react-icons/ri";
import "./Label.css";

const Label = forwardRef((props, sref) => {
  const [imageList, setImageList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageInfo, setImageInfo] = useState({ label: "", labeledBy: "" });
  const [latestLabeled, setLatestLabeled] = useState([]);
  const inputRef = useRef(null);
  const [allLabeledImages, setAllLabeledImages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [showCrop, setShowCrop] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [message, setMessage] = useState("");

  const { user, uploadComponent } = props;

  useImperativeHandle(sref, () => ({
    handleUpload: (fileUrls) => {
      setImageUrl(fileUrls);
      loadImageList();
    },
  }));

  useImperativeHandle(sref, () => ({
    handleUpload: (fileUrls) => {
      setImageUrl(fileUrls);
      loadImageList();
    },
  }));

  useEffect(() => {
    const savedDataset = localStorage.getItem("selectedDataset");
    if (savedDataset) {
      setSelectedDataset(savedDataset);
    }

    fetchDatasets();
  }, []);
  useEffect(() => {
    if (imageList.length > 0) {
      loadImage(imageList[imageList.length - 1], 0);
    } else {
      setImageUrl("");
      setSelectedImage(null);
    }
  }, [imageList]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        handlePrevImage();
      } else if (e.key === "ArrowRight") {
        handleNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, imageList.length]);

  const loadImageList = async () => {
    if (!selectedDataset) {
      console.log("No dataset selected");
      return;
    }

    try {
      const datasetRef = ref(imageDb, `multipleFiles/${selectedDataset}`);
      const result = await listAll(datasetRef);
      const imageFiles = result.items.filter(
        (item) =>
          !item.name.includes(".placeholder") && !item.name.endsWith(".csv")
      );

      const sortedFiles = await Promise.all(
        imageFiles.map(async (item) => {
          const metadata = await getMetadata(item);
          return {
            ref: item,
            lastModified: metadata.updated,
          };
        })
      );

      sortedFiles.sort((a, b) => b.lastModified - a.lastModified);

      const imageRefs = sortedFiles.map((file) => file.ref);
      setImageList(imageRefs);
      setTotalImages(imageRefs.length);

      if (imageRefs.length > 0) {
        await loadImage(imageRefs[0], 0);
      } else {
        setImageUrl("");
        setSelectedImage(null);
      }
    } catch (error) {
      console.error("Error loading image list:", error);
    }
  };

  const loadImage = async (imageRef, index) => {
    try {
      console.log("Loading image:", imageRef.name);
      const url = await getDownloadURL(imageRef);
      setImageUrl(url);
      setCurrentIndex(index);
      setSelectedImage(imageRef);
      const currentImageBaseName = imageRef.name.split("_").pop();

      const querySnapshot = await getDocs(
        collection(firestoreDb, "labeled_images")
      );

      const labelDoc = querySnapshot.docs.find((doc) => {
        const data = doc.data();
        const storedImageBaseName = data.imagePath.split("_").pop();

        return currentImageBaseName === storedImageBaseName;
      });

      if (labelDoc && labelDoc.data().label) {
        const labeledData = labelDoc.data();
        console.log("Found label:", labeledData);
        setImageInfo({
          label: labeledData.label,
          labeledBy: labeledData.labeledBy,
          status: "labeled",
        });
        setLabel(labeledData.label);
      } else {
        console.log("No label found");
        setImageInfo({
          label: "",
          labeledBy: "",
          status: "unlabeled",
        });
        setLabel("");
      }

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error("Error loading image:", error);
    }
  };

  const handlePrevImage = () => {
    if (currentIndex > 0) {
      loadImage(imageList[currentIndex - 1], currentIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (currentIndex < imageList.length - 1) {
      loadImage(imageList[currentIndex + 1], currentIndex + 1);
    }
  };

  const handleSaveLabel = async (img = selectedImage, newLabel = label) => {
    if (!img || !img.name || !newLabel.trim()) {
      console.log("No label or image selected.");
      alert("Vui lòng nhập nhãn!");
      return;
    }

    try {
      const currentUserEmail = user?.email || "unknown";
      const timestamp = new Date().toISOString();
      setLabel("");
      setImageInfo({
        label: newLabel.trim(),
        labeledBy: currentUserEmail,
        status: "labeled",
        coordinates: imageInfo.coordinates || null,
      });

      const metadata = {
        customMetadata: {
          label: newLabel.trim(),
          labeledBy: currentUserEmail,
          timestamp: timestamp,
          dataset: selectedDataset,
          coordinates: imageInfo.coordinates
            ? JSON.stringify(imageInfo.coordinates)
            : "",
        },
      };

      const sourceImageRef = ref(
        imageDb,
        `multipleFiles/${selectedDataset}/${img.name}`
      );
      const labeledImageRef = ref(
        imageDb,
        `labeled_images/${selectedDataset}/${img.name}`
      );

      const [sourceUrl] = await Promise.all([getDownloadURL(sourceImageRef)]);
      const response = await fetch(sourceUrl);
      const imageBlob = await response.blob();

      const [uploadResult] = await Promise.all([
        uploadBytes(labeledImageRef, imageBlob, metadata),
        deleteObject(sourceImageRef).catch((error) => {
          console.error("Error deleting original image:", error);
        }),
      ]);

      const labeledUrl = await getDownloadURL(uploadResult.ref);
      const newLabeledData = {
        name: img.name,
        label: newLabel.trim(),
        labeledBy: currentUserEmail,
        timestamp: timestamp,
        coordinates: imageInfo.coordinates || null,
        dataset: selectedDataset,
        status: "labeled",
        imagePath: `labeled_images/${selectedDataset}/${img.name}`,
      };
      newLabeledData.url = labeledUrl;

      console.log("Saving labeled data to Firestore:", newLabeledData);

      await setDoc(
        doc(firestoreDb, "labeled_images", img.name),
        newLabeledData
      );

      setLatestLabeled((prev) => {
        const newList = [newLabeledData, ...prev].slice(0, 6);
        return newList;
      });

      const updatedImageList = imageList.filter(
        (image) => image.name !== img.name
      );
      setImageList(updatedImageList);

      if (updatedImageList.length > 0) {
        const nextIndex = Math.min(currentIndex, updatedImageList.length - 1);
        loadImage(updatedImageList[nextIndex], nextIndex);
      } else {
        setImageUrl("");
        setSelectedImage(null);
        setMessage("Đã gán nhãn tất cả ảnh trong dataset.");
      }

      loadLabeledImages(0);
      setMessage(`Đã lưu nhãn cho ảnh ${img.name}!`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving label:", error);
      setMessage("Lỗi khi lưu nhãn. Vui lòng thử lại!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const fetchAllLabeledImages = async () => {
    if (!selectedDataset) {
      console.log("No dataset selected");
      return;
    }

    try {
      console.log("Fetching all labeled images");
      const csvRef = ref(
        imageDb,
        `labeled_images/${selectedDataset}/${selectedDataset}.csv`
      );
      const url = await getDownloadURL(csvRef);
      const response = await fetch(url);
      const csvText = await response.text();

      const lines = csvText.split("\n");
      const headerLine = lines[0];
      if (!headerLine.includes("Image URL")) {
        console.error("Invalid CSV format");
        setLatestLabeled([]);
        setAllLabeledImages([]);
        return;
      }

      const dataLines = lines.slice(1);
      const labeledData = await Promise.all(
        dataLines
          .filter((line) => line.trim())
          .map(async (line) => {
            try {
              const [imageUrl, label, labeledBy, timestamp, coordinates] =
                line.split(",");
              if (!imageUrl || !label) return null;
              const imageName = decodeURIComponent(
                imageUrl.split("/").pop().split("?")[0]
              );
              const imageRef = ref(
                imageDb,
                `labeled_images/${selectedDataset}/${imageName}`
              );

              try {
                await getDownloadURL(imageRef);
                return {
                  url: imageUrl,
                  name: imageName,
                  label: label,
                  labeledBy: labeledBy,
                  timestamp: timestamp,
                  coordinates:
                    coordinates && coordinates.trim() !== '""'
                      ? JSON.parse(coordinates.replace(/^"|"$/g, ""))
                      : null,
                };
              } catch (error) {
                console.log(
                  `Image ${imageName} not found in storage, skipping...`
                );
                return null;
              }
            } catch (error) {
              console.error("Error parsing line:", line, error);
              return null;
            }
          })
      );

      const validData = labeledData.filter((item) => item !== null);
      validData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setAllLabeledImages(validData);
      setLatestLabeled(validData.slice(0, 6));
    } catch (error) {
      console.error("Error fetching labeled images:", error);
      setLatestLabeled([]);
      setAllLabeledImages([]);
    }
  };

  const loadLabeledImages = async (page = 0) => {
    if (!selectedDataset) return;

    try {
      console.log("Loading labeled images for dataset:", selectedDataset);
      const labeledImagesRef = ref(
        imageDb,
        `labeled_images/${selectedDataset}`
      );
      const result = await listAll(labeledImagesRef);
      const labeledData = await Promise.all(
        result.items.map(async (item) => {
          try {
            const url = await getDownloadURL(item);
            const metadata = await getMetadata(item);
            const customMetadata = metadata.customMetadata || {};
            console.log("Image metadata:", item.name, customMetadata);

            return {
              name: item.name,
              url: url,
              label: customMetadata.label || "Unknown",
              labeledBy: customMetadata.labeledBy || "Unknown",
              timestamp: customMetadata.timestamp || metadata.timeCreated,
              coordinates: customMetadata.coordinates
                ? JSON.parse(customMetadata.coordinates)
                : null,
            };
          } catch (error) {
            console.error(`Error processing image ${item.name}:`, error);
            return null;
          }
        })
      );

      const validData = labeledData.filter((item) => item !== null);
      validData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const startIndex = page * 6;
      const endIndex = startIndex + 6;
      const selectedImages = validData.slice(startIndex, endIndex);

      console.log("Loaded labeled images:", selectedImages);

      setLatestLabeled(selectedImages);
      setAllLabeledImages(validData);
      setPageIndex(page);
    } catch (error) {
      console.error("Error loading labeled images:", error);
      setLatestLabeled([]);
      setAllLabeledImages([]);
    }
  };

  const handleDeleteLabeledImage = async (imageName) => {
    if (!selectedDataset) {
      alert("Please select a dataset first!");
      return;
    }

    try {
      console.log("Deleting image:", imageName);

      const imageRef = ref(
        imageDb,
        `multipleFiles/${selectedDataset}/${imageName}`
      );
      try {
        await deleteObject(imageRef);
        console.log("Image deleted from storage:", imageName);
      } catch (error) {
        console.error("Error deleting from storage:", error);
        throw error;
      }
      try {
        await deleteDoc(doc(firestoreDb, "labeled_images", imageName));
        console.log("Image deleted from Firestore:", imageName);
      } catch (error) {
        console.error("Error deleting from Firestore:", error);
      }
      setImageList((prevList) =>
        prevList.filter((image) => image.name !== imageName)
      );
      setLatestLabeled((prev) => prev.filter((img) => img.name !== imageName));

      if (imageList.length <= 1) {
        setSelectedImage(null);
        setImageUrl("");
      } else {
        const nextIndex = Math.min(currentIndex, imageList.length - 2);
        await loadImage(imageList[nextIndex], nextIndex);
      }

      console.log("Image deletion completed");
    } catch (error) {
      console.error("Error in deletion process:", error);
    }
  };

  const handlePrevPage = () => {
    if (pageIndex > 0) {
      loadLabeledImages(pageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if ((pageIndex + 1) * 6 < allLabeledImages.length) {
      loadLabeledImages(pageIndex + 1);
    }
  };

  const handleStopLabeling = async () => {
    if (!selectedDataset) {
      alert("Vui lòng chọn dataset trước khi tải file CSV!");
      return;
    }

    try {
      const labeledImagesRef = ref(
        imageDb,
        `labeled_images/${selectedDataset}`
      );
      const result = await listAll(labeledImagesRef);

      if (result.items.length === 0) {
        alert("Không có ảnh nào được gán nhãn trong dataset này!");
        return;
      }

      const headers = "Image URL,Label,Label By,Top Left,Bottom Right\n";
      let csvContent = headers;

      const processedItems = await Promise.all(
        result.items.map(async (item) => {
          try {
            const [url, metadata] = await Promise.all([
              getDownloadURL(item),
              getMetadata(item),
            ]);

            const customMetadata = metadata.customMetadata || {};
            const label = customMetadata.label || "";
            const labeledBy = customMetadata.labeledBy || "";
            let topLeft = "";
            let bottomRight = "";

            if (customMetadata.coordinates) {
              try {
                const coords = JSON.parse(customMetadata.coordinates);
                if (coords) {
                  const x1 = Math.round(coords.x);
                  const y1 = Math.round(coords.y);
                  const x2 = Math.round(coords.x + coords.width);
                  const y2 = Math.round(coords.y + coords.height);

                  topLeft = `${x1}:${y1}`;
                  bottomRight = `${x2}:${y2}`;
                }
              } catch (coordError) {
                console.error(
                  "Error parsing coordinates for",
                  item.name,
                  coordError
                );
              }
            }

            return `${url},${label},${labeledBy},${topLeft},${bottomRight}`;
          } catch (error) {
            console.error(`Error processing image ${item.name}:`, error);
            return null;
          }
        })
      );

      csvContent += processedItems.filter((line) => line !== null).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${selectedDataset}_labeled_images.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setMessage("Đã tải xuống file CSV thành công!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error in handleStopLabeling:", error);
      setMessage("Có lỗi xảy ra khi tạo file CSV. Vui lòng thử lại!");
    }
  };

  const handleSaveUpdatedLabel = async (index) => {
    const updatedImage = latestLabeled[index];
    try {
      const currentUserEmail = user?.email || "unknown";

      const imageRef = ref(
        imageDb,
        `labeled_images/${selectedDataset}/${updatedImage.name}`
      );
      const metadata = await getMetadata(imageRef);
      const customMetadata = metadata.customMetadata || {};

      const newMetadata = {
        customMetadata: {
          ...customMetadata,
          label: updatedImage.label.trim(),
          labeledBy: currentUserEmail,
          timestamp: new Date().toISOString(),
          coordinates: customMetadata.coordinates || null,
          dataset: selectedDataset,
          status: "labeled",
        },
      };
      await updateMetadata(imageRef, newMetadata);

      await setDoc(doc(firestoreDb, "labeled_images", updatedImage.name), {
        name: updatedImage.name,
        url: updatedImage.url,
        label: updatedImage.label.trim(),
        labeledBy: currentUserEmail,
        timestamp: new Date().toISOString(),
        coordinates: updatedImage.coordinates || null,
        dataset: selectedDataset,
        status: "labeled",
        imagePath: `labeled_images/${selectedDataset}/${updatedImage.name}`,
      });

      setLatestLabeled((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                label: updatedImage.label.trim(),
                labeledBy: currentUserEmail,
                timestamp: new Date().toISOString(),
              }
            : item
        )
      );

      setAllLabeledImages((prev) =>
        prev.map((item) =>
          item.name === updatedImage.name
            ? {
                ...item,
                label: updatedImage.label.trim(),
                labeledBy: currentUserEmail,
                timestamp: new Date().toISOString(),
              }
            : item
        )
      );

      setMessage("Nhãn đã được cập nhật thành công!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating label:", error);
      setMessage("Lỗi khi cập nhật nhãn. Vui lòng thử lại!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleDeleteRecentLabeledImage = async (imageName) => {
    if (!selectedDataset) {
      alert("Please select a dataset first!");
      return;
    }

    try {
      const imageRef = ref(
        imageDb,
        `labeled_images/${selectedDataset}/${imageName}`
      );
      await deleteObject(imageRef);
      await deleteDoc(doc(firestoreDb, "labeled_images", imageName));
      setLatestLabeled((prev) => prev.filter((img) => img.name !== imageName));
      setAllLabeledImages((prev) =>
        prev.filter((img) => img.name !== imageName)
      );

      if (latestLabeled.length <= 1 && pageIndex > 0) {
        const newPageIndex = pageIndex - 1;
        setPageIndex(newPageIndex);
        const startIndex = newPageIndex * 6;
        const endIndex = startIndex + 6;
        const remainingImages = allLabeledImages.filter(
          (img) => img.name !== imageName
        );
        setLatestLabeled(remainingImages.slice(startIndex, endIndex));
      }

      await loadLabeledImages(pageIndex);

      setMessage(`Đã xóa ảnh ${imageName} thành công!`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error in deletion process:", error);
      setMessage("Lỗi khi xóa ảnh. Vui lòng thử lại!");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const fetchDatasets = async () => {
    try {
      console.log("Fetching datasets...");
      const datasetsRef = ref(imageDb, "multipleFiles");
      const result = await listAll(datasetsRef);
      const folders = result.prefixes
        .map((prefix) => ({
          name: prefix.name,
          path: prefix.fullPath,
        }))
        .filter(
          (folder) => folder.name !== "undefined" && folder.name.trim() !== ""
        );

      console.log("Found folders:", folders);
      setDatasets(folders);

      const savedDataset = localStorage.getItem("selectedDataset");
      if (savedDataset && folders.some((f) => f.name === savedDataset)) {
        setSelectedDataset(savedDataset);
        loadImageList();
      } else {
        localStorage.removeItem("selectedDataset");
        setSelectedDataset("");
      }
    } catch (error) {
      console.error("Error fetching datasets:", error);
      setDatasets([]);
      setSelectedDataset("");
    }
  };

  const handleDatasetChange = (e) => {
    const dataset = e.target.value;
    if (!dataset || dataset === "undefined") {
      setSelectedDataset("");
      localStorage.removeItem("selectedDataset");
      return;
    }
    console.log("Selected dataset:", dataset);
    setSelectedDataset(dataset);
    localStorage.setItem("selectedDataset", dataset);
    loadImageList();
    loadLabeledImages(0);
  };

  const handleLoadDataset = async () => {
    if (!selectedDataset) {
      alert("Please select a dataset first!");
      return;
    }
    console.log("Loading dataset:", selectedDataset);

    try {
      await loadImageList();
      localStorage.setItem("selectedDataset", selectedDataset);
    } catch (error) {
      console.error("Error loading dataset:", error);
      setImageUrl("");
      setSelectedImage(null);
      setImageList([]);
      setTotalImages(0);
    }
  };

  useEffect(() => {
    if (selectedDataset) {
      loadImageList();
      loadLabeledImages(0);
    }
  }, [selectedDataset]);

  const dataURLtoFile = (dataurl, filename) => {
    try {
      const arr = dataurl.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      // ...
    } catch (error) {
      console.error("Error converting dataURL:", error);
      return null;
    }
  };

  return (
    <div className="label-container">
      <div className="main-content">
        <div className="label-section">
          {uploadComponent}
          <div className="label-header">
            <h1>Label Image</h1>
            <div className="dataset-selector-container">
              <select
                value={selectedDataset}
                onChange={handleDatasetChange}
                className="dataset-selector"
              >
                <option value="">Select Dataset</option>
                {datasets.map((dataset) => (
                  <option key={dataset.name} value={dataset.name}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLoadDataset}
                className="select-dataset-btn"
                disabled={!selectedDataset}
              >
                Select Dataset
              </button>
            </div>
          </div>
          {imageUrl && !showCrop ? (
            <>
              {imageUrl && (
                <div className="label-area">
                  <img src={imageUrl} alt="Ảnh đang label" width="300" />
                  <p>
                    <b>File:</b> {selectedImage?.name}
                  </p>
                  <div className="navigation-container">
                    <button
                      onClick={handlePrevImage}
                      disabled={currentIndex === 0}
                    >
                      {"<"} Prev
                    </button>

                    <span>
                      {currentIndex + 1} / {imageList.length}
                    </span>
                    <button
                      onClick={handleNextImage}
                      disabled={currentIndex === imageList.length - 1}
                    >
                      Next {">"}
                    </button>
                  </div>
                  <p>
                    <b>Status:</b>{" "}
                    {imageInfo.label
                      ? `${imageInfo.label} - by ${imageInfo.labeledBy}`
                      : "Unlabeled"}
                  </p>
                  <div
                    className="button-group"
                    style={{ display: "flex", gap: "10px" }}
                  >
                    <button
                      onClick={handleStopLabeling}
                      className="stop-button"
                      disabled={!selectedDataset}
                    >
                      Stop
                    </button>
                    <button
                      type="success"
                      onClick={() => setShowCrop(true)}
                      className="crop-button"
                    >
                      Crop Image
                    </button>
                  </div>
                </div>
              )}
              <div className="label-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter label..."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
                />
                <button
                  className="delete-labeled-button"
                  onClick={() => handleDeleteLabeledImage(selectedImage?.name)}
                >
                  <RiDeleteBinLine size={18} />
                  <span>Delete</span>
                </button>
              </div>
            </>
          ) : showCrop ? (
            <CropComponent
              imageUrl={imageUrl}
              selectedImage={selectedImage}
              imageList={imageList}
              setImageList={setImageList}
              setSelectedImage={setSelectedImage}
              setImageUrl={setImageUrl}
              selectedDataset={selectedDataset}
              onUploadComplete={async (uploadedDataArray) => {
                try {
                  console.log("Upload completed:", uploadedDataArray);
                  setShowCrop(false);
                  setLatestLabeled((prev) => {
                    const newLabeled = [...uploadedDataArray, ...prev].slice(
                      0,
                      6
                    );
                    return newLabeled;
                  });

                  const updatedImageList = imageList.filter(
                    (image) => image.name !== selectedImage?.name
                  );
                  setImageList(updatedImageList);

                  if (updatedImageList.length > 0) {
                    const nextIndex = Math.min(
                      currentIndex,
                      updatedImageList.length - 1
                    );
                    await loadImage(updatedImageList[nextIndex], nextIndex);
                  } else {
                    setImageUrl("");
                    setSelectedImage(null);
                    setMessage("Đã xử lý tất cả ảnh trong dataset.");
                  }

                  await loadLabeledImages(0);
                } catch (error) {
                  console.error("Error in onUploadComplete:", error);
                  setMessage("Có lỗi xảy ra khi xử lý ảnh. Vui lòng thử lại.");
                }
              }}
              onExit={() => setShowCrop(false)}
            />
          ) : (
            <div className="no-image-section">
              <div
                className="button-group"
                style={{ display: "flex", gap: "10px" }}
              >
                {selectedDataset && (
                  <button
                    onClick={handleStopLabeling}
                    className="stop-button"
                    disabled={!selectedDataset}
                  >
                    Stop
                  </button>
                )}
                <button
                  type="success"
                  onClick={() => setShowCrop(true)}
                  className="crop-button"
                >
                  Crop Image
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Labeled*/}
      <div className="recent-labels">
        <h2>Recent Labeled</h2>
        <div className="recent-images">
          {latestLabeled.map((img, index) => (
            <div key={index} className="recent-item">
              <div className="image-container">
                <img
                  src={img.url}
                  alt={`Labeled ${index}`}
                  className="recent-image"
                />
              </div>
              <div className="label-container">
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={img.label}
                    style={{
                      width: "100%",
                      padding: "8px",
                      boxSizing: "border-box",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      marginRight: "8px",
                    }}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setLatestLabeled((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, label: newLabel } : item
                        )
                      );
                    }}
                  />
                </div>
                <div className="button-container">
                  <button
                    className="save-button"
                    onClick={() => handleSaveUpdatedLabel(index)}
                  >
                    Save
                  </button>
                  <button
                    className="delete-icon-button"
                    onClick={() => handleDeleteRecentLabeledImage(img.name)}
                  >
                    <RiDeleteBinLine size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pagination">
          <button onClick={handlePrevPage} disabled={pageIndex === 0}>
            {"<"} Prev
          </button>
          <span>Page {pageIndex + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={(pageIndex + 1) * 6 >= allLabeledImages.length}
          >
            Next {">"}
          </button>
        </div>
      </div>
    </div>
  );
});

export default Label;
