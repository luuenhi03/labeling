import React, { useState, useRef } from "react";
import Login from "./components/Login";
import Label from "./components/Label";
import FirebaseImageUpload from "./firebase/FirebaseImageUpload";
import { FiLogOut } from "react-icons/fi";
import "./App.css";

const App = () => {
  const [user, setUser] = useState(() => {
    // Kiểm tra localStorage khi khởi tạo state
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogin = (loggedInUser) => {
    // Lưu user vào localStorage khi đăng nhập
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    // Xóa user khỏi localStorage khi đăng xuất
    localStorage.removeItem("user");
    setUser(null);
  };

  const handleUploadSuccess = (fileUrls) => {
    labelRef.current.handleUpload(fileUrls);
  };

  const labelRef = useRef(null);

  return (
    <div className="App">
      {user ? (
        <>
          <div style={{ position: "absolute", top: "10px", right: "10px" }}>
            <button className="logout-button" onClick={handleLogout}>
              <FiLogOut /> Logout
            </button>
          </div>
          <Label
            ref={labelRef}
            user={user}
            uploadComponent={
              <FirebaseImageUpload onUploadSuccess={handleUploadSuccess} />
            }
          />
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
