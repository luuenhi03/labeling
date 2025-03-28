import React, { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { imageDb } from "../firebase/firebaseConfig";
import { v4 as uuidv4 } from "uuid";
import "./CropComponent.css";
import { doc, setDoc } from "firebase/firestore";
import { firestoreDb } from "../firebase/firebaseConfig";

export default function CropComponent({
  imageUrl,
  selectedImage,
  imageList,
  setImageList,
  setSelectedImage,
  setImageUrl,
  onUploadComplete,
  onExit,
  selectedDataset,
}) {
  const cropperRef = useRef(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const dataURLtoFile = (dataurl, filename) => {
    try {
      const arr = dataurl.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (error) {
      console.error("Error converting dataURL to File:", error);
      return null;
    }
  };

  const onCrop = () => {
    if (!fileName) {
      alert("Vui lòng nhập nhãn trước khi crop ảnh.");
      return;
    }
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      try {
        const croppedDataUrl = cropper
          .getCroppedCanvas()
          .toDataURL("image/jpeg", 0.9);
        const coordinates = cropper.getData();
        setCroppedImages((prev) => [
          ...prev,
          {
            dataUrl: croppedDataUrl,
            fileName,
            coordinates: {
              x: Math.round(coordinates.x),
              y: Math.round(coordinates.y),
              width: Math.round(coordinates.width),
              height: Math.round(coordinates.height),
            },
          },
        ]);
        setFileName("");
      } catch (error) {
        console.error("Error during cropping:", error);
        alert("Có lỗi xảy ra khi crop ảnh. Vui lòng thử lại.");
      }
    }
  };

  const handleDeleteCroppedImage = (index) => {
    setCroppedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (croppedImages.length === 0) {
      alert("Không có ảnh nào để upload.");
      return;
    }

    setIsUploading(true);
    const uploadedDataArray = [];

    try {
      // Upload từng ảnh đã crop
      for (const { dataUrl, fileName, coordinates } of croppedImages) {
        // Tạo file từ dataURL
        const file = dataURLtoFile(dataUrl, `${fileName}.jpg`);
        if (!file) {
          throw new Error("Không thể tạo file từ ảnh đã crop");
        }

        // Tạo tên file duy nhất và upload vào thư mục labeled_images/dataset
        const uniqueFileName = `${uuidv4()}_${file.name}`;
        const imagePath = `labeled_images/${selectedDataset}/${uniqueFileName}`;
        const imageRef = ref(imageDb, imagePath);

        // Upload ảnh với metadata
        const metadata = {
          contentType: "image/jpeg",
          customMetadata: {
            label: fileName,
            coordinates: JSON.stringify(coordinates),
            status: "labeled",
            dataset: selectedDataset,
            timestamp: new Date().toISOString(),
            labeledBy: "user@email.com", // Thêm thông tin người gán nhãn
          },
        };

        // Upload và lấy URL
        await uploadBytes(imageRef, file, metadata);
        const url = await getDownloadURL(imageRef);

        // Thêm document vào Firestore
        await setDoc(doc(firestoreDb, "labeled_images", uniqueFileName), {
          name: uniqueFileName,
          url: url,
          label: fileName,
          coordinates: coordinates,
          dataset: selectedDataset,
          status: "labeled",
          timestamp: metadata.customMetadata.timestamp,
          labeledBy: metadata.customMetadata.labeledBy,
          imagePath: imagePath,
        });

        uploadedDataArray.push({
          name: uniqueFileName,
          url: url,
          label: fileName,
          coordinates: coordinates,
          dataset: selectedDataset,
          status: "labeled",
          timestamp: metadata.customMetadata.timestamp,
          labeledBy: metadata.customMetadata.labeledBy,
        });
      }

      // Xóa ảnh gốc sau khi đã crop và upload thành công
      if (selectedImage) {
        try {
          const originalImageRef = ref(
            imageDb,
            `multipleFiles/${selectedDataset}/${selectedImage.name}`
          );
          await deleteObject(originalImageRef);
          console.log("Original image deleted:", selectedImage.name);
        } catch (error) {
          console.error("Error deleting original image:", error);
          // Tiếp tục xử lý ngay cả khi không xóa được ảnh gốc
        }
      }

      // Reset state và gọi callback
      setCroppedImages([]);
      if (onUploadComplete) {
        onUploadComplete(uploadedDataArray);
      }
    } catch (error) {
      console.error("Error during upload:", error);
      alert("Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="crop-container">
      <div className="cropper-wrapper">
        <Cropper
          ref={cropperRef}
          src={imageUrl}
          style={{ height: 400, width: "100%" }}
          initialAspectRatio={16 / 9}
          guides={true}
          viewMode={1}
          minCropBoxHeight={10}
          minCropBoxWidth={10}
          background={false}
          responsive={true}
          autoCropArea={1}
          checkOrientation={false}
          movable={true}
          rotatable={true}
          scalable={true}
          zoomable={true}
        />
      </div>
      <div className="upload-controls">
        <input
          type="text"
          placeholder="Nhập nhãn..."
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isUploading) {
              onCrop();
            }
          }}
          disabled={isUploading}
        />
        <button onClick={onCrop} disabled={isUploading}>
          Crop
        </button>
      </div>
      <div className="cropped-images-container">
        {croppedImages.map((img, index) => (
          <div key={index} className="cropped-image-wrapper">
            <img
              src={img.dataUrl}
              alt={`Cropped ${index}`}
              className="cropped-image"
            />
            <button
              className="delete-button"
              onClick={() => handleDeleteCroppedImage(index)}
              title="Xóa ảnh"
              disabled={isUploading}
            >
              ×
            </button>
            <div className="image-label">{img.fileName}</div>
          </div>
        ))}
      </div>
      <div className="button-group">
        <button
          onClick={handleUploadAll}
          className="upload-button"
          disabled={isUploading || croppedImages.length === 0}
        >
          {isUploading ? "Loading..." : "Upload all"}
        </button>
        <button onClick={onExit} className="exit-button" disabled={isUploading}>
          Exit
        </button>
      </div>
    </div>
  );
}
