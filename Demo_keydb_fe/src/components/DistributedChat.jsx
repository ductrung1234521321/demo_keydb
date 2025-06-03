import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './DistributedChat.css'

const API_BASE = 'http://localhost:8080';

export default function DistributedChat() {
  const [user, setUser] = useState('');
  const [step, setStep] = useState(1);
  const [channelsJoined, setChannelsJoined] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [chatInfo, setChatInfo] = useState(null);
  const [sendingMsg, setSendingMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [isResetting, setIsResetting] = useState(false);
  const [resetTTL, setResetTTL] = useState(0);
  const messagesEndRef = useRef(null);

  // Scroll tới cuối khi có message mới
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [historyMessages]);

  // Poll trạng thái reset + messages
  useEffect(() => {
    let interval;
    if (step === 3 && chatInfo?.channel) {
      interval = setInterval(async () => {
        // Poll reset TTL
        try {
          const res = await fetch(`${API_BASE}/messages/channel/${encodeURIComponent(chatInfo.channel)}/reset-ttl`);
          if (res.ok) {
            const ttl = await res.json();
            setIsResetting(ttl > 0);
            setResetTTL(ttl);
          }
        } catch {//
          }
        // Poll message list
        try {
          const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(chatInfo.channel)}/messages`);
          if (res.ok) {
            const history = await res.json();
            setHistoryMessages(history);
          }
        } catch {//
          }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, chatInfo]);

  // B1: Login
  const handleStart = async () => {
    if (!user.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/messages/user/${encodeURIComponent(user)}/channels`);
      if (!res.ok) throw new Error('API Error');
      const channels = await res.json();
      setChannelsJoined(channels);
      setStep(2);
    } catch  {
      alert('Không lấy được danh sách kênh, vui lòng thử lại.');
    }
  };

  // Join channel mới
  const handleJoinChannel = async () => {
    const channel = newChannel.trim();
    if (!channel) return alert("Nhập tên channel để join");
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(channel)}/join/${encodeURIComponent(user)}`, { method: 'POST' });
    if (res.ok) {
      setSelectedChannel(channel);
      const channels = await (await fetch(`${API_BASE}/messages/user/${encodeURIComponent(user)}/channels`)).json();
      setChannelsJoined(channels);
      setNewChannel('');
    } else {
      alert("Lỗi join channel");
    }
  };

  // Leave channel
  const handleLeaveChannel = async () => {
    if (!selectedChannel) return alert("Chọn channel muốn leave");
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(selectedChannel)}/leave/${encodeURIComponent(user)}`, { method: 'POST' });
    if (res.ok) {
      const channels = await (await fetch(`${API_BASE}/messages/user/${encodeURIComponent(user)}/channels`)).json();
      setChannelsJoined(channels);
      setSelectedChannel('');
    } else {
      alert("Lỗi leave channel");
    }
  };

  // Xóa channel
  const handleDeleteChannel = async () => {
    if (!selectedChannel) return alert("Chọn channel muốn xóa");
    if (!window.confirm(`Bạn chắc chắn muốn xóa channel "${selectedChannel}"?`)) return;
    const res = await fetch(`${API_BASE}/messages/channel/${encodeURIComponent(selectedChannel)}`, { method: 'DELETE' });
    if (res.ok) {
      const channels = await (await fetch(`${API_BASE}/messages/user/${encodeURIComponent(user)}/channels`)).json();
      setChannelsJoined(channels);
      setSelectedChannel('');
    } else {
      alert("Lỗi xóa channel");
    }
  };

  // Vào chat channel
  const handleEnterChat = async (channel) => {
    try {
      const nodeRes = await fetch(`${API_BASE}/messages/user/${encodeURIComponent(user)}/node-info`);
      const nodeInfo = nodeRes.ok ? await nodeRes.text() : '';
      const hisRes = await fetch(`${API_BASE}/messages/${encodeURIComponent(channel)}/messages`);
      const history = hisRes.ok ? await hisRes.json() : [];
      setChatInfo({ nodeInfo, channel });
      setHistoryMessages(history);
      setStep(3);
      setIsResetting(false);
      setResetTTL(0);
    } catch  {
      alert('Lỗi lấy lịch sử chat');
    }
  };

  // Gửi tin nhắn
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isResetting) return alert("Channel đang được reset, không gửi được tin nhắn!");
    if (!sendingMsg.trim() || !chatInfo?.channel) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(chatInfo.channel)}/send/${encodeURIComponent(user)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: sendingMsg
      });
      if (!res.ok) throw new Error('Gửi tin thất bại');
      setSendingMsg('');
      // Reload lịch sử
      const hisRes = await fetch(`${API_BASE}/messages/${encodeURIComponent(chatInfo.channel)}/messages`);
      setHistoryMessages(hisRes.ok ? await hisRes.json() : []);
    } catch {
      alert('Gửi tin nhắn thất bại!');
    }
    setSending(false);
  };

  // Xóa message
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Bạn có chắc muốn xóa tin nhắn này?")) return;
    try {
      const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(user)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
      if (res.ok) {
        // Xóa thành công thì reload lại lịch sử chat
        const hisRes = await fetch(`${API_BASE}/messages/${encodeURIComponent(chatInfo.channel)}/messages`);
        setHistoryMessages(hisRes.ok ? await hisRes.json() : []);
      }
    } catch {
      alert("Không thể xóa tin nhắn, thử lại!");
    }
  };

  // Reset channel
 // Khi nhấn Reset channel
const handleResetChannel = async () => {
  if (!chatInfo?.channel) return;
  if (!window.confirm(`Bạn có chắc chắn muốn reset lại channel "${chatInfo.channel}"?`)) return;
  try {
    const res = await fetch(`${API_BASE}/messages/channel/${encodeURIComponent(chatInfo.channel)}/reset?admin=${encodeURIComponent(user)}`, { method: 'POST' });
    if (res.ok) {
      // Nếu lấy được lock và reset thành công
      alert("Bạn đã acquire lock thành công! Channel sẽ được reset trong 10 giây...");
      setHistoryMessages([]);
      setIsResetting(false);
      setResetTTL(0);
    } else if (res.status === 409) {
      // Không acquire được lock do người khác đang reset
      const text = await res.text();
      setIsResetting(true);
      // Parse TTL còn lại từ response text
      const match = text.match(/TTL còn: (\d+)/);
      if (match) setResetTTL(Number(match[1]));
      alert("Có người khác đang reset channel này!\n" + text);
    } else {
      alert("Reset channel thất bại, vui lòng thử lại.");
    }
  } catch {
    alert("Lỗi khi gọi API reset channel.");
  }
};


  // Quay lại danh sách channel
  const handleBackToChannelList = () => {
    setStep(2);
    setHistoryMessages([]);
    setChatInfo(null);
    setSendingMsg('');
    setIsResetting(false);
    setResetTTL(0);
  };
  // Quay lại login
  const handleBackToLogin = () => {
    setStep(1);
    setUser('');
    setChannelsJoined([]);
    setSelectedChannel('');
    setNewChannel('');
  };

  // UI step 1: Login
  if (step === 1) {
    return (
      <div className="chat-wrapper">
        <motion.div
          style={{
            background: "#dec0f9",
            borderRadius: 28,
            boxShadow: "0 8px 40px #b48cd8a0",
            minWidth: 340, maxWidth: 420, width: "96vw",
            padding: "40px 36px 32px 36px",
            display: "flex", flexDirection: "column", alignItems: "center"
          }}
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
        >
          <form
            style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
            onSubmit={e => { e.preventDefault(); handleStart(); }}
          >
            <h2 style={{ color: "#8e44ad", fontWeight: 900, fontSize: "2.1em" }}>Đăng nhập để bắt đầu</h2>
            <input
              type="text"
              placeholder="Nhập tên User"
              value={user}
              onChange={e => setUser(e.target.value)}
              autoFocus
              style={{
                textAlign: 'center', fontSize: '1.35em', height: '2.6em', fontWeight: 600,
                borderRadius: 16, border: "1.3px solid #ca97eb", background: "#faf7fd", color: "#7c44a8", minWidth: 180
              }}
            />
            <button
              type="submit"
              style={{
                padding: "0.9em 2.2em", borderRadius: 17, border: "none", fontWeight: 800,
                background: "linear-gradient(90deg, #c27be2 0%, #8e44ad 100%)", color: "#fff", fontSize: "1.13em",
                cursor: "pointer", boxShadow: "0 1.5px 8px #b095df19"
              }}
            >Vào chat</button>
          </form>
        </motion.div>
      </div>
    );
  }

  // UI step 2: Chọn/join/leave/xóa kênh
  if (step === 2) {
    return (
      <div className="chat-wrapper">
        <motion.div
          style={{
            background: "#dec0f9", borderRadius: 28, boxShadow: "0 8px 40px #b48cd8a0",
            minWidth: 340, maxWidth: 480, width: "96vw", padding: "38px 36px 32px 36px", 
            display: "flex", flexDirection: "column", alignItems: "center"
          }}
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        >
          <h2 style={{
            fontWeight: 800, fontSize: "2.1rem", marginBottom: 18, color: "#9b35d6",
            textAlign: "center", letterSpacing: "0.01em"
          }}>
            Xin chào <span style={{ color: "#8e44ad", fontWeight: 900 }}>{user}</span>!
          </h2>
          <div style={{ width: "100%", textAlign: "center", marginBottom: 20 }}>
            <strong style={{ color: "#9b35d6", fontSize: "1.08em", fontWeight: 700, marginBottom: 8, display: "inline-block" }}>
              Các kênh đã tham gia:
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5em", justifyContent: "center", marginTop: 8 }}>
              {channelsJoined.length === 0 && <span style={{ color: "#aaa" }}>Chưa tham gia kênh nào</span>}
              {channelsJoined.map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSelectedChannel(ch)}
                  style={{
                    padding: "0.47em 1.12em", borderRadius: 20,
                    border: selectedChannel === ch ? "2px solid #8e44ad" : "1.4px solid #ca97eb",
                    background: selectedChannel === ch ? "#f5e9ff" : "#f6effd",
                    color: selectedChannel === ch ? "#8e44ad" : "#a574cc",
                    fontWeight: selectedChannel === ch ? 700 : 600,
                    fontSize: "1.05em", outline: "none",
                    boxShadow: selectedChannel === ch ? "0 2px 10px #ca97eb22" : "none",
                    cursor: "pointer", transition: "all 0.19s"
                  }}
                >{ch}</button>
              ))}
            </div>
          </div>
          <form
            style={{
              width: "100%", display: "flex", flexDirection: "row", flexWrap: "wrap",
              gap: "0.75em", justifyContent: "center", alignItems: "center", marginBottom: 18
            }}
            onSubmit={e => { e.preventDefault(); handleJoinChannel(); }}
          >
            <input
              type="text"
              placeholder="Tên channel mới để Join"
              value={newChannel}
              onChange={e => setNewChannel(e.target.value)}
              style={{
                flex: "1 1 150px", padding: "0.75em 1em", fontSize: "1.1em", borderRadius: 15,
                border: "1.3px solid #ca97eb", background: "#faf7fd", color: "#7c44a8",
                minWidth: 135, maxWidth: 200
              }}
            />
            <button
              type="submit"
              style={{
                padding: "0.7em 1.3em", borderRadius: 15, border: "none", fontSize: "1.05em", fontWeight: 700,
                background: "linear-gradient(90deg, #c27be2 0%, #8e44ad 100%)", color: "#fff", cursor: "pointer",
                boxShadow: "0 1.5px 8px #b095df19"
              }}
            >Join Channel</button>
            <button
              type="button"
              onClick={handleLeaveChannel}
              disabled={!selectedChannel}
              style={{
                padding: "0.7em 1.3em", border: "none", fontSize: "1.05em", fontWeight: 700,
                background: !selectedChannel ? "#ecd9fa" : "linear-gradient(90deg, #be8bd1 0%, #995ed6 90%)",
                color: !selectedChannel ? "#b79ccf" : "#fff",
                cursor: !selectedChannel ? "not-allowed" : "pointer",
                opacity: !selectedChannel ? 0.55 : 1, boxShadow: "0 1.5px 8px #b095df15"
              }}
            >Leave Channel</button>
            <button
              type="button"
              onClick={handleDeleteChannel}
              disabled={!selectedChannel}
              style={{
                padding: "0.7em 1.3em", border: "none", fontSize: "1.05em", fontWeight: 700,
                background: !selectedChannel ? "#f9e0e0" : "#eb4d5c",
                color: !selectedChannel ? "#dd99a3" : "#fff",
                cursor: !selectedChannel ? "not-allowed" : "pointer",
                opacity: !selectedChannel ? 0.55 : 1, boxShadow: "0 1.5px 8px #d9898918"
              }}
            >Xóa Channel</button>
          </form>
          <button
            type="button"
            disabled={!selectedChannel}
            onClick={() => handleEnterChat(selectedChannel)}
            style={{
              padding: "0.92em 2.3em", borderRadius: 20,
              background: !selectedChannel ? "#d1c2f5" : "linear-gradient(90deg, #c27be2 0%, #8e44ad 100%)",
              color: !selectedChannel ? "#a39ad0" : "#fff", fontSize: "1.13em", fontWeight: 800,
              border: "none", cursor: !selectedChannel ? "not-allowed" : "pointer",
              opacity: !selectedChannel ? 0.65 : 1,
              boxShadow: !selectedChannel ? "none" : "0 1.5px 11px #cba7f39b",
              margin: "10px 0 0 0", transition: "all 0.18s"
            }}
          >Vào khung chat</button>
          <button
            type="button"
            onClick={handleBackToLogin}
            style={{
              marginTop: 16, background: "transparent", color: "#ab72c4", border: "none", fontWeight: 600, cursor: "pointer"
            }}
          >← Đăng xuất / Đổi user</button>
        </motion.div>
      </div>
    );
  }

  // UI các step giữ nguyên, riêng step 3 (chat) sẽ thay đổi phần message như sau:
  if (step === 3 && chatInfo) {
    return (
      <div className="chat-wrapper">
        <motion.div
          style={{
            background: "#fff", borderRadius: 22, boxShadow: "0 8px 34px #b48cd82c",
            minWidth: 350, maxWidth: 510, width: "97vw",
            padding: "26px 24px 22px 24px", display: "flex", flexDirection: "column", alignItems: "stretch"
          }}
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        >
          <div style={{ marginBottom: 10, color: "#8e44ad", fontWeight: 700, fontSize: "1.07em", textAlign: "center" }}>
            <span>🟣 <b>{user}</b> | {chatInfo.nodeInfo}</span>
            <div style={{ color: '#c17ae6', fontWeight: 500 }}>Channel: <b>{chatInfo.channel}</b></div>
          </div>
         {isResetting && (
  <div style={{
    background: "#ffe6a1", color: "#c49000", padding: "10px 18px", borderRadius: 16,
    marginBottom: 10, textAlign: "center", fontWeight: 700, fontSize: "1.09em"
  }}>
    <span>
      🔒 Channel đang bị reset bởi user khác.<br />
      Vui lòng đợi {resetTTL > 0 ? `${resetTTL} giây` : ''} rồi thử lại chức năng reset/gửi tin!
    </span>
  </div>
)}

          <div style={{
            flex: "1 1 auto", minHeight: 200, maxHeight: 320, overflowY: "auto",
            background: "#f8f3fc", borderRadius: 15, padding: "10px 14px", marginBottom: 12
          }}>
            {historyMessages.length === 0
              ? <div style={{ color: "#b7b7b7", fontStyle: "italic" }}>Chưa có tin nhắn nào trong channel này.</div>
              : historyMessages.map((msg, idx) => {
                const isMe = msg.user === user;
                const dateStr = msg.timestamp
                  ? new Date(Number(msg.timestamp)).toLocaleTimeString('vi-VN')
                  : '';
                const key = `${msg.user}_${msg.timestamp}_${idx}`;
                return (
                  <div key={key} style={{ marginBottom: 8, textAlign: isMe ? "right" : "left", position: "relative" }}>
                    <span style={{
                      background: isMe ? "#dec0f9" : "#eee6fc",
                      color: "#8e44ad",
                      padding: "7px 14px",
                      borderRadius: 18,
                      fontWeight: 500,
                      display: "inline-block",
                      maxWidth: 350,
                      wordBreak: "break-word"
                    }}>
                      <b>{msg.user}</b>
                      <span style={{ fontWeight: 400, color: "#888", fontSize: "0.91em", marginLeft: 7 }}>
                        {dateStr}
                      </span>
                      <br />
                      {msg.msg}
                      {isMe && msg.id &&
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          style={{
                            marginLeft: 10, color: "#b94c6b", background: "transparent",
                            border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.98em"
                          }}
                          title="Xóa tin nhắn này"
                        >✖</button>
                      }
                    </span>
                  </div>
                );
              })
            }
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 7, marginTop: 2 }}>
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              value={sendingMsg}
              onChange={e => setSendingMsg(e.target.value)}
              style={{
                flex: 1, padding: "0.8em 1em", fontSize: "1em",
                borderRadius: 13, border: "1.2px solid #ca97eb", background: "#faf7fd", color: "#7c44a8"
              }}
              disabled={sending || isResetting}
            />
            <button
              type="submit"
              style={{
                padding: "0.7em 1.35em", borderRadius: 13, border: "none", fontWeight: 700,
                background: "linear-gradient(90deg, #c27be2 0%, #8e44ad 100%)", color: "#fff", cursor: isResetting ? "not-allowed" : "pointer"
              }}
              disabled={sending || isResetting}
            >Gửi</button>

            <button
              type="button"
              onClick={handleResetChannel}
              disabled={isResetting}
              style={{
                padding: "0.7em 1.35em", borderRadius: 13, border: "none", fontWeight: 700,
                background: isResetting ? "#e2c5cc" : "#eb4d5c", color: "#fff", cursor: isResetting ? "not-allowed" : "pointer"
              }}
            >Reset channel</button>

            <button
              type="button"
              onClick={handleBackToChannelList}
              style={{
                padding: "0.7em 1.35em", border: "none", fontWeight: 700,
                background: "#ececec", color: "#b95be0", marginLeft: 3, cursor: "pointer"
              }}
            >← Quay lại</button>
          </form>
          <button
            type="button"
            onClick={handleBackToLogin}
            style={{
              marginTop: 16, background: "transparent", color: "#ab72c4", border: "none", fontWeight: 600, cursor: "pointer"
            }}
          >← Đăng xuất / Đổi user</button>
        </motion.div>
      </div>
    );
  }

  // Các step 1, 2 giữ như cũ, chỉ thêm nút “Quay lại đăng nhập” ở step 2 nếu muốn.

  return null;
}
