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

export default function CropComponent({
  imageUrl,
  selectedImage,
  imageList,
  setImageList,
  setSelectedImage,
  setImageUrl,
  onUploadComplete,
  onExit,
}) {
  const cropperRef = useRef(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [fileName, setFileName] = useState("");

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const onCrop = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper && fileName) {
      const croppedDataUrl = cropper.getCroppedCanvas().toDataURL();
      setCroppedImages((prev) => [
        ...prev,
        { dataUrl: croppedDataUrl, fileName },
      ]);
      setFileName("");
    } else {
      alert("Please enter a label before cropping.");
    }
  };

  const handleDeleteCroppedImage = (index) => {
    setCroppedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (croppedImages.length === 0) {
      alert("No cropped images to upload.");
      return;
    }

    console.log("Uploading all cropped images:", croppedImages);
    const uploadedDataArray = [];

    for (const { dataUrl, fileName } of croppedImages) {
      const file = dataURLtoFile(dataUrl, fileName);
      try {
        const uniqueFileName = `${uuidv4()}_${file.name}`;
        const imagePath = `labeled_images/${uniqueFileName}`;
        const imageRef = ref(imageDb, imagePath);

        await uploadBytes(imageRef, file);
        const url = await getDownloadURL(imageRef);

        const cropper = cropperRef.current?.cropper;
        let coordinates = null;
        if (cropper) {
          const cropBoxData = cropper.getCropBoxData();
          coordinates = {
            topLeft: { x: cropBoxData.left, y: cropBoxData.top },
            bottomRight: {
              x: cropBoxData.left + cropBoxData.width,
              y: cropBoxData.top + cropBoxData.height,
            },
          };
        }

        uploadedDataArray.push({
          name: uniqueFileName,
          label: fileName,
          url,
          coordinates,
        });
      } catch (error) {
        console.error("Upload error:", error);
        return;
      }
    }

    if (uploadedDataArray.length === croppedImages.length && selectedImage) {
      try {
        const originalImageRef = ref(
          imageDb,
          `multipleFiles/${selectedImage.name}`
        );
        await deleteObject(originalImageRef);
        console.log("Original image deleted:", selectedImage.name);

        setImageList((prev) =>
          prev.filter((image) => image.name !== selectedImage.name)
        );
        if (imageList.length > 1) {
          setSelectedImage(imageList[1]);
        } else {
          setImageUrl("");
          setSelectedImage(null);
        }
      } catch (error) {
        console.error("Error deleting original image:", error);
      }
    }

    setCroppedImages([]);
    if (onUploadComplete) onUploadComplete(uploadedDataArray);
  };

  return (
    <div className="crop-container">
      <div className="cropper-wrapper">
        <Cropper
          src={imageUrl}
          style={{ height: 400, width: "100%" }}
          initialAspectRatio={16 / 9}
          guides={true}
          ref={cropperRef}
        />
      </div>
      <div className="upload-controls">
        <input
          type="text"
          placeholder="Enter label..."
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
        <button onClick={onCrop}>Crop</button>
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
            >
              X
            </button>
          </div>
        ))}
      </div>
      <div className="button-group">
        <button onClick={handleUploadAll} className="upload-button">
          Upload All
        </button>
        <button onClick={onExit} className="exit-button">
          Exit
        </button>
      </div>
    </div>
  );
}
