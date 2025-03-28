import React, { useState, useRef, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { imageDb } from "./firebaseConfig";
import { v4 as uuidv4 } from "uuid";
import "./FirebaseImageUpload.css";

function FirebaseImageUpload({ onUploadSuccess }) {
  const [images, setImages] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [newDatasetName, setNewDatasetName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const imagesRef = useRef([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const datasetsRef = ref(imageDb, "multipleFiles");
      const result = await listAll(datasetsRef);

      // Get only folders (prefixes)
      const folders = result.prefixes.map((prefix) => ({
        name: prefix.name,
        path: prefix.fullPath,
      }));

      setDatasets(folders);
    } catch (error) {
      console.error("Error fetching datasets:", error);
      setMessage("Error loading datasets!");
    }
  };

  const handleFileSelect = (event) => {
    const newFiles = Array.from(event.target.files);
    setImages((prevImages) => [...prevImages, ...newFiles]);
    imagesRef.current = [...imagesRef.current, ...newFiles];
  };

  const createNewDataset = async () => {
    if (!newDatasetName.trim()) {
      setMessage("Please enter a dataset name!");
      return;
    }

    try {
      // Create a placeholder file to create the folder
      const placeholderRef = ref(
        imageDb,
        `multipleFiles/${newDatasetName.trim()}/.placeholder`
      );
      const placeholderContent = new Blob([""], { type: "text/plain" });
      await uploadBytes(placeholderRef, placeholderContent);

      await fetchDatasets();
      setNewDatasetName("");
      setSelectedDataset(newDatasetName.trim());
      setMessage("New dataset created successfully!");
    } catch (error) {
      console.error("Error creating dataset:", error);
      setMessage("Error creating dataset!");
    }
  };

  const uploadFiles = async () => {
    if (!selectedDataset && !newDatasetName) {
      setMessage("Please select or create a dataset first!");
      return;
    }

    const datasetName = selectedDataset || newDatasetName.trim();
    if (!selectedDataset) {
      await createNewDataset();
    }

    setUploading(true);
    try {
      const uploadedImages = [];

      const uploadTasks = imagesRef.current.map(async (image) => {
        const fileName = `${uuidv4()}_${image.name}`;
        const imagePath = `multipleFiles/${datasetName}/${fileName}`;
        const imageRef = ref(imageDb, imagePath);

        await uploadBytes(imageRef, image);
        const url = await getDownloadURL(imageRef);

        uploadedImages.push({
          name: fileName,
          fullPath: imageRef.fullPath,
          url,
        });
      });

      await Promise.all(uploadTasks);

      setMessage(
        `Upload ${uploadedImages.length} images to dataset ${datasetName} success!`
      );
      setTimeout(() => setMessage(""), 5000);
      setImages([]);
      imagesRef.current = [];
      fileInputRef.current.value = null;

      if (onUploadSuccess) {
        onUploadSuccess(uploadedImages.map((img) => img.url));
      }
    } catch (error) {
      console.error("Upload Error:", error);
      setMessage("Upload error!: " + error.message);
    }

    setUploading(false);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (imagesRef.current.length > 0) {
          uploadFiles();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedDataset, newDatasetName]);

  return (
    <div className="upload-container">
      <div className="upload-controls">
        <div className="dataset-controls">
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            disabled={uploading}
          >
            <option value="">Select Dataset</option>
            {datasets.map((dataset) => (
              <option key={dataset.name} value={dataset.name}>
                {dataset.name}
              </option>
            ))}
          </select>
          <div className="new-dataset">
            <input
              type="text"
              placeholder="Or create new dataset..."
              value={newDatasetName}
              onChange={(e) => setNewDatasetName(e.target.value)}
              disabled={uploading || selectedDataset}
            />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        <button
          onClick={uploadFiles}
          disabled={uploading || (!selectedDataset && !newDatasetName)}
        >
          {uploading ? "Uploading..." : "Submit"}
        </button>
        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
}

export default FirebaseImageUpload;
