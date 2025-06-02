// src/App.jsx
import React from 'react';
import DistributedChat from './components/DistributedChat';  // đường dẫn đến file bạn tạo
import './index.css'; // hoặc App.css nếu bạn để styles ở đó

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <DistributedChat />
    </div>
  );
}

export default App;
