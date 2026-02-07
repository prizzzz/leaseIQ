import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  FileText,
  User,
  Loader2,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../services/api";
import "./ChatWindow.css";

const ChatWindow = ({ contract, onSendMessage, onUploadSuccess }) => {
  const [inputValue, setInputValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [contract?.chatHistory, isUploading, isAiStreaming]);

  const handleSend = async () => {
    const hasText = inputValue.trim() !== "";
    const hasFile = stagedFile !== null;

    if ((!hasText && !hasFile) || isUploading || isAiStreaming) return;

    const currentMessage = inputValue.trim();
    const currentFile = stagedFile;

    setInputValue("");
    setStagedFile(null);

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const userMsg = {
      id: Date.now(),
      sender: "user",
      type: hasFile ? "file" : "text",
      fileName: hasFile ? currentFile.name : null,
      text: hasFile ? (currentMessage || `Uploaded: ${currentFile.name}`) : currentMessage,
      time: currentTime,
    };

    const latestContract = await onSendMessage(userMsg);
    const chatId = latestContract?.id;

    if (hasFile) {
      setIsUploading(true);
      try {
        const response = await api.uploadContract(currentFile);
        const serverFile = response.data.filename;
        onUploadSuccess(currentFile, response.data);
        await fetchAiResponse(currentMessage || "Please summarize this document.", serverFile, chatId);
      } catch (err) {
        console.error("❌ Upload/Analysis failed:", err);
      } finally {
        setIsUploading(false);
      }
    } else {
      await fetchAiResponse(currentMessage, latestContract?.serverFilename, chatId);
    }
  };

  const fetchAiResponse = async (userQuery, overrideFilename = null, chatId = null) => {
    setIsAiStreaming(true);
    let accumulatedText = ""; 
    let displayLines = ""; // FIXED: Defined at top level of function scope
    const aiMessageId = Date.now();

    const filenameToUse = overrideFilename || contract?.serverFilename || null;
    const targetId = chatId || contract?.id;

    try {
      const response = await api.sendChatMessage(userQuery, filenameToUse);
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Create initial empty AI bubble
      onSendMessage({
        id: aiMessageId,
        sender: "ai",
        text: "",
        isStreaming: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }, { id: targetId });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Try to parse as JSON or clean the raw stream string
        try {
          const parsed = JSON.parse(accumulatedText);
          displayLines = parsed.assistant_message;
        } catch (e) {
          // Regex to strip JSON markers during partial stream
          displayLines = accumulatedText
            .replace(/^\{"assistant_message":\s*"/, "") 
            .replace(/"\}$|",\s*"counter_email_draft".*$/, "") 
            .replace(/\\n/g, "\n") 
            .replace(/\\"/g, '"'); 
        }

        onSendMessage({
          id: aiMessageId,
          sender: "ai",
          text: displayLines,
          isUpdate: true,
          isStreaming: true,
        }, { id: targetId });
      }

      // Final Cleanup Update
      onSendMessage({
        id: aiMessageId,
        sender: "ai",
        text: displayLines,
        isUpdate: true,
        isStreaming: false,
      }, { id: targetId });

    } catch (error) {
      console.error("❌ AI Stream Error:", error);
      onSendMessage({
        sender: "ai",
        text: "Connection error. Please check if the backend is running.",
      }, { id: targetId });
    } finally {
      setIsAiStreaming(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      setStagedFile(file);
    } else if (file) {
      alert("Please upload a PDF file.");
    }
    event.target.value = null;
  };

  const triggerUpload = (e) => {
    e.preventDefault();
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const showWelcome = !contract || !contract.chatHistory || contract.chatHistory.length === 0;

  return (
    <div className={`chat-window ${showWelcome ? "is-welcome" : "is-active"}`}>
      <div className="chat-container">
        <div className="chat-content-wrapper" ref={scrollRef}>
          {showWelcome ? (
            <div className="welcome-container">
              <div className="welcome-content">
                <div className="logo-badge">
                  <Sparkles size={40} className="text-teal-400" />
                </div>
                <h1>How can LeaseIQ help today?</h1>
                <p>Upload a car lease contract for an instant AI analysis.</p>
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {contract.chatHistory.map((msg, i) => (
                <div key={msg.id || i} className={`message ${msg.sender}`}>
                  <div className="avatar-header">
                    <div className={`avatar ${msg.sender === "ai" ? "ai-icon" : "user-icon"}`}>
                      {msg.sender === "ai" ? "L" : <User size={12} />}
                    </div>
                    <span className="sender-name">
                      {msg.sender === "ai" ? "LeaseIQ" : "You"}
                    </span>
                    <span className="timestamp">{msg.time}</span>
                  </div>
                  <div className="msg-bubble">
                    {msg.type === "file" ? (
                      <div className="file-container">
                        <div className="file-attachment-bubble">
                          <FileText size={18} className="text-teal-500" />
                          <div className="file-details">
                            <span className="file-name-text">{msg.fileName}</span>
                            <span className="file-meta">Document Loaded</span>
                          </div>
                        </div>
                        {msg.text && (
                          <div className="msg-content mt-2 markdown-body">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="msg-content markdown-body">
                        <ReactMarkdown>{msg.text || "..."}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(isUploading || isAiStreaming) && (
                <div className="message ai">
                  <div className="msg-bubble typing-indicator">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{isUploading ? "Running OCR Analysis..." : "LeaseIQ is typing..."}</span>
                  </div>
                </div>
              )}
              <div className="scroll-bottom-spacer" />
            </div>
          )}
        </div>

        <div className="chat-input-area">
          <div className="input-wrapper-container">
            {stagedFile && (
              <div className="staged-file-preview">
                <FileText size={14} />
                <span className="staged-name">{stagedFile.name}</span>
                <button className="remove-staged-btn" onClick={() => setStagedFile(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="input-wrapper">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                style={{ display: "none" }}
              />
              <button
                type="button"
                className={`attach-btn ${stagedFile ? "has-file" : ""}`}
                onClick={triggerUpload}
                disabled={isUploading || isAiStreaming}
              >
                <Paperclip size={20} />
              </button>
              <input
                type="text"
                placeholder={stagedFile ? "Message with attachment..." : "Ask LeaseIQ anything..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={isAiStreaming}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={(!inputValue.trim() && !stagedFile) || isUploading || isAiStreaming}
              >
                <Send size={16} />
              </button>
            </div>
            <p className="disclaimer">
              Verify all financial results. LeaseIQ is an AI assistant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;







// import React, { useState, useEffect, useRef } from "react";
// import ReactMarkdown from "react-markdown";
// import {
//   Send,
//   FileText,
//   User,
//   Loader2,
//   Paperclip,
//   Sparkles,
//   X,
// } from "lucide-react";
// import { api } from "../services/api";
// import "./ChatWindow.css";

// const ChatWindow = ({
//   contract,
//   onSendMessage,
//   onUploadSuccess,
// }) => {
//   const [inputValue, setInputValue] = useState("");
//   const [isUploading, setIsUploading] = useState(false);
//   const [isAiStreaming, setIsAiStreaming] = useState(false);
//   const [stagedFile, setStagedFile] = useState(null);
//   const scrollRef = useRef(null);
//   const fileInputRef = useRef(null);

//   // Auto-scroll logic
//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTo({
//         top: scrollRef.current.scrollHeight,
//         behavior: "smooth",
//       });
//     }
//   }, [contract?.chatHistory, isUploading, isAiStreaming]);

//   const handleSend = async () => {
//     const hasText = inputValue.trim() !== "";
//     const hasFile = stagedFile !== null;
    
//     if ((!hasText && !hasFile) || isUploading || isAiStreaming) return;

//     const currentMessage = inputValue.trim();
//     const currentFile = stagedFile;
    
//     setInputValue("");
//     setStagedFile(null);

//     const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

//     const userMsg = {
//       id: Date.now(),
//       sender: "user",
//       type: hasFile ? "file" : "text",
//       fileName: hasFile ? currentFile.name : null,
//       text: hasFile ? (currentMessage || `Uploaded: ${currentFile.name}`) : currentMessage,
//       time: currentTime,
//     };

//     // 1. Capture the new contract/session data immediately
//     const latestContract = await onSendMessage(userMsg);
//     // 2. Extract the ID so we don't use 'undefined'
//     const chatId = latestContract?.id;

//     if (hasFile) {
//       setIsUploading(true);
//       try {
//         const response = await api.uploadContract(currentFile);
//         const serverFile = response.data.filename;
//         onUploadSuccess(currentFile, response.data);

//         // Pass chatId here 
//         await fetchAiResponse(currentMessage || "Please summarize this document.", serverFile, chatId);
//       } catch (err) {
//         console.error("❌ Upload/Analysis failed:", err);
//       } finally {
//         setIsUploading(false);
//       }
//     } else {
//       // Pass chatId here
//       await fetchAiResponse(currentMessage, latestContract?.serverFilename, chatId);
//     }
//   };// Added chatId as the 3rd parameter
//   const fetchAiResponse = async (userQuery, overrideFilename = null, chatId = null) => {
//     setIsAiStreaming(true);
//     let fullAiText = "";
//     const aiMessageId = Date.now();

//     // Context Resolution
//     const filenameToUse = overrideFilename || contract?.serverFilename || null;
//     // Use the passed chatId OR fall back to the prop
//     const targetId = chatId || contract?.id;

//     try {
//       const response = await api.sendChatMessage(userQuery, filenameToUse);

//       if (!response.ok) throw new Error(`Server responded with ${response.status}`);

//       const reader = response.body.getReader();
//       const decoder = new TextDecoder();

//       // 3. Create initial empty AI bubble
//       // We pass { id: targetId } as the second argument to target the right chat
//       onSendMessage({
//         id: aiMessageId,
//         sender: "ai",
//         text: "",
//         isStreaming: true,
//         time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
//       }, { id: targetId }); 

//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;

//         const chunk = decoder.decode(value, { stream: true });
//         fullAiText += chunk;

//         // 5. Update bubble in real-time
//         onSendMessage({
//           id: aiMessageId,
//           sender: "ai",
//           text: fullAiText,
//           isUpdate: true,
//           isStreaming: true,
//         }, { id: targetId }); // Always tell App.jsx which ID to update
//       }

//       // 6. Final Update
//       onSendMessage({
//         id: aiMessageId,
//         sender: "ai",
//         text: fullAiText,
//         isUpdate: true,
//         isStreaming: false,
//       }, { id: targetId });

//     } catch (error) {
//       console.error("❌ AI Stream Error:", error);
//       onSendMessage({
//         sender: "ai",
//         text: "Connection error. Please check if the backend is running.",
//       }, { id: targetId });
//     } finally {
//       setIsAiStreaming(false);
//     }
//   };
//   const handleFileChange = (event) => {
//     const file = event.target.files[0];
//     if (file && file.type === "application/pdf") {
//       setStagedFile(file);
//     } else if (file) {
//       alert("Please upload a PDF file.");
//     }
//     event.target.value = null;
//   };

//   const triggerUpload = (e) => {
//     e.preventDefault();
//     if (fileInputRef.current) fileInputRef.current.click();
//   };

//   const showWelcome = !contract || !contract.chatHistory || contract.chatHistory.length === 0;

//   return (
//     <div className={`chat-window ${showWelcome ? "is-welcome" : "is-active"}`}>
//       <div className="chat-container">
//         <div className="chat-content-wrapper" ref={scrollRef}>
//           {showWelcome ? (
//             <div className="welcome-container">
//               <div className="welcome-content">
//                 <div className="logo-badge">
//                   <Sparkles size={40} className="text-teal-400" />
//                 </div>
//                 <h1>How can LeaseIQ help today?</h1>
//                 <p>Upload a car lease contract for an instant AI analysis.</p>
//               </div>
//             </div>
//           ) : (
//             <div className="chat-messages">
//               {contract.chatHistory.map((msg, i) => (
//                 <div key={msg.id || i} className={`message ${msg.sender}`}>
//                   <div className="avatar-header">
//                     <div className={`avatar ${msg.sender === "ai" ? "ai-icon" : "user-icon"}`}>
//                       {msg.sender === "ai" ? "L" : <User size={12} />}
//                     </div>
//                     <span className="sender-name">
//                       {msg.sender === "ai" ? "LeaseIQ" : "You"}
//                     </span>
//                     <span className="timestamp">{msg.time}</span>
//                   </div>
//                   <div className="msg-bubble">
//                     {msg.type === "file" ? (
//                       <div className="file-container">
//                         <div className="file-attachment-bubble">
//                           <FileText size={18} className="text-teal-500" />
//                           <div className="file-details">
//                             <span className="file-name-text">{msg.fileName}</span>
//                             <span className="file-meta">Document Loaded</span>
//                           </div>
//                         </div>
//                         {msg.text && (
//                           <div className="msg-content mt-2 markdown-body">
//                             <ReactMarkdown>{msg.text}</ReactMarkdown>
//                           </div>
//                         )}
//                       </div>
//                     ) : (
//                       <div className="msg-content markdown-body">
//                         <ReactMarkdown>{msg.text || "..."}</ReactMarkdown>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               ))}

//               {(isUploading || isAiStreaming) && (
//                 <div className="message ai">
//                   <div className="msg-bubble typing-indicator">
//                     <Loader2 size={14} className="animate-spin" />
//                     <span>{isUploading ? "Running OCR Analysis..." : "LeaseIQ is typing..."}</span>
//                   </div>
//                 </div>
//               )}
//               <div className="scroll-bottom-spacer" />
//             </div>
//           )}
//         </div>

//         <div className="chat-input-area">
//           <div className="input-wrapper-container">
//             {stagedFile && (
//               <div className="staged-file-preview">
//                 <FileText size={14} />
//                 <span className="staged-name">{stagedFile.name}</span>
//                 <button className="remove-staged-btn" onClick={() => setStagedFile(null)}>
//                   <X size={14} />
//                 </button>
//               </div>
//             )}

//             <div className="input-wrapper">
//               <input
//                 type="file"
//                 ref={fileInputRef}
//                 onChange={handleFileChange}
//                 accept=".pdf"
//                 style={{ display: "none" }}
//               />
//               <button
//                 type="button"
//                 className={`attach-btn ${stagedFile ? "has-file" : ""}`}
//                 onClick={triggerUpload}
//                 disabled={isUploading || isAiStreaming}
//               >
//                 <Paperclip size={20} />
//               </button>
//               <input
//                 type="text"
//                 placeholder={stagedFile ? "Message with attachment..." : "Ask LeaseIQ anything..."}
//                 value={inputValue}
//                 onChange={(e) => setInputValue(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
//                 disabled={isAiStreaming}
//               />
//               <button
//                 className="send-btn"
//                 onClick={handleSend}
//                 disabled={(!inputValue.trim() && !stagedFile) || isUploading || isAiStreaming}
//               >
//                 <Send size={16} />
//               </button>
//             </div>
//             <p className="disclaimer">
//               Verify all financial results. LeaseIQ is an AI assistant.
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ChatWindow;


// import React, { useState, useEffect, useRef } from "react";
// import ReactMarkdown from "react-markdown";
// import {
//   Send,
//   FileText,
//   User,
//   Loader2,
//   Paperclip,
//   Sparkles,
//   X,
// } from "lucide-react";
// import { api } from "../services/api";
// import "./ChatWindow.css";

// const ChatWindow = ({
//   contract,
//   onSendMessage,
//   onUploadSuccess,
// }) => {
//   const [inputValue, setInputValue] = useState("");
//   const [isUploading, setIsUploading] = useState(false);
//   const [isAiStreaming, setIsAiStreaming] = useState(false);
//   const [stagedFile, setStagedFile] = useState(null);
//   const scrollRef = useRef(null);
//   const fileInputRef = useRef(null);

//   // Auto-scroll to bottom on new messages or streaming updates
//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTo({
//         top: scrollRef.current.scrollHeight,
//         behavior: "smooth",
//       });
//     }
//   }, [contract?.chatHistory, isUploading, isAiStreaming]);

//   const handleSend = async () => {
//     const hasText = inputValue.trim() !== "";
//     const hasFile = stagedFile !== null;
    
//     if ((!hasText && !hasFile) || isUploading || isAiStreaming) return;

//     const currentMessage = inputValue.trim();
//     const currentFile = stagedFile;
    
//     setInputValue("");
//     setStagedFile(null);

//     const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

//     if (hasFile) {
//       // 1. Handle File Upload
//       onSendMessage({
//         sender: "user",
//         type: "file",
//         fileName: currentFile.name,
//         text: currentMessage || `Uploaded: ${currentFile.name}`,
//         time: currentTime,
//       }); 
//       await uploadFile(currentFile);
//     } else {
//       // 2. Handle Text Query
//       onSendMessage({
//         sender: "user",
//         text: currentMessage,
//         time: currentTime,
//       });
//       await fetchAiResponse(currentMessage);
//     }
//   };

//   const fetchAiResponse = async (userQuery) => {
//     setIsAiStreaming(true);
//     let fullAiText = "";
//     const aiMessageId = Date.now(); // Unique ID to track this specific stream

//     try {
//       const response = await api.sendChatMessage(userQuery, contract?.serverFilename);

//       if (!response.ok) throw new Error("Failed to connect to AI");

//       // Initialize the stream reader
//       const reader = response.body.getReader();
//       const decoder = new TextDecoder();

//       // Create a placeholder message for the AI
//       onSendMessage({
//         id: aiMessageId,
//         sender: "ai",
//         text: "",
//         isStreaming: true,
//         time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
//       });

//       // Stream processing loop
//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;

//         const chunk = decoder.decode(value, { stream: true });
//         fullAiText += chunk;

//         // Trigger an update in App.jsx for the existing message
//         onSendMessage({
//           id: aiMessageId,
//           sender: "ai",
//           text: fullAiText,
//           isUpdate: true,
//         });
//       }
//     } catch (error) {
//       console.error("Chat Error:", error);
//       onSendMessage({
//         sender: "ai",
//         text: "I'm having trouble connecting to the lease analyzer. Please check your connection and try again.",
//         time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
//       });
//     } finally {
//       setIsAiStreaming(false);
//     }
//   };

//   const uploadFile = async (file) => {
//     setIsUploading(true);
//     try {
//       const response = await api.uploadLease(file);
//       // Backend should return 'filename' (server ID) and 'data' (extracted JSON)
//       onUploadSuccess(file, response.data); 
//     } catch (error) {
//       console.error("Error uploading file:", error);
//       alert("Analysis failed. The PDF might be encrypted or unreadable.");
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const handleFileChange = (event) => {
//     const file = event.target.files[0];
//     if (file && file.type === "application/pdf") {
//       setStagedFile(file);
//     } else if (file) {
//       alert("Please upload a PDF file.");
//     }
//     event.target.value = null;
//   };

//   const triggerUpload = (e) => {
//     e.preventDefault();
//     if (fileInputRef.current) fileInputRef.current.click();
//   };

//   const showWelcome = !contract || !contract.chatHistory || contract.chatHistory.length === 0;

//   return (
//     <div className={`chat-window ${showWelcome ? "is-welcome" : "is-active"}`}>
//       <div className="chat-container">
//         <div className="chat-content-wrapper" ref={scrollRef}>
//           {showWelcome ? (
//             <div className="welcome-container">
//               <div className="welcome-content">
//                 <div className="logo-badge">
//                   <Sparkles size={40} className="text-teal-400" />
//                 </div>
//                 <h1>How can LeaseIQ help today?</h1>
//                 <p>Upload a car lease contract for a deep financial and legal analysis.</p>
//               </div>
//             </div>
//           ) : (
//             <div className="chat-messages">
//               {contract.chatHistory.map((msg, i) => (
//                 <div key={msg.id || i} className={`message ${msg.sender}`}>
//                   <div className="avatar-header">
//                     <div className={`avatar ${msg.sender === "ai" ? "ai-icon" : "user-icon"}`}>
//                       {msg.sender === "ai" ? "L" : <User size={12} />}
//                     </div>
//                     <span className="sender-name">
//                       {msg.sender === "ai" ? "LeaseIQ" : "You"}
//                     </span>
//                     <span className="timestamp">{msg.time}</span>
//                   </div>
//                   <div className="msg-bubble">
//                     {msg.type === "file" ? (
//                       <div className="file-container">
//                         <div className="file-attachment-bubble">
//                           <FileText size={18} className="text-teal-500" />
//                           <div className="file-details">
//                             <span className="file-name-text">{msg.fileName}</span>
//                             <span className="file-meta">Lease Analyzed</span>
//                           </div>
//                         </div>
//                         {msg.text && (
//                           <div className="msg-content mt-2 markdown-body">
//                             <ReactMarkdown>{msg.text}</ReactMarkdown>
//                           </div>
//                         )}
//                       </div>
//                     ) : (
//                       <div className="msg-content markdown-body">
//                         <ReactMarkdown>{msg.text || "..."}</ReactMarkdown>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               ))}

//               {/* Specific Loader for active tasks */}
//               {isUploading && (
//                 <div className="message ai">
//                   <div className="msg-bubble typing-indicator">
//                     <Loader2 size={14} className="animate-spin" />
//                     <span>OCR Engines running...</span>
//                   </div>
//                 </div>
//               )}
//               <div className="scroll-bottom-spacer" />
//             </div>
//           )}
//         </div>

//         <div className="chat-input-area">
//           <div className="input-wrapper-container">
//             {stagedFile && (
//               <div className="staged-file-preview">
//                 <FileText size={14} />
//                 <span className="staged-name">{stagedFile.name}</span>
//                 <button className="remove-staged-btn" onClick={() => setStagedFile(null)}>
//                   <X size={14} />
//                 </button>
//               </div>
//             )}

//             <div className="input-wrapper">
//               <input
//                 type="file"
//                 ref={fileInputRef}
//                 onChange={handleFileChange}
//                 accept=".pdf"
//                 style={{ display: "none" }}
//               />
//               <button
//                 type="button"
//                 className={`attach-btn ${stagedFile ? "has-file" : ""}`}
//                 onClick={triggerUpload}
//                 disabled={isUploading || isAiStreaming}
//               >
//                 <Paperclip size={20} />
//               </button>
//               <input
//                 type="text"
//                 placeholder={stagedFile ? "Add details about this file..." : "Ask about your lease terms..."}
//                 value={inputValue}
//                 onChange={(e) => setInputValue(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
//                 disabled={isAiStreaming}
//               />
//               <button
//                 className="send-btn"
//                 onClick={handleSend}
//                 disabled={(!inputValue.trim() && !stagedFile) || isUploading || isAiStreaming}
//               >
//                 {isAiStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
//               </button>
//             </div>
//             <p className="disclaimer">
//               Powered by LeaseIQ Intelligence. Verify all financial calculations.
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ChatWindow;














// import React, { useState, useEffect, useRef } from "react";
// import ReactMarkdown from "react-markdown"; // ADDED THIS
// import {
//   Send,
//   FileText,
//   User,
//   PanelRight,
//   Loader2,
//   Paperclip,
//   Sparkles,
//   X,
// } from "lucide-react";
// import { api } from "../services/api";
// import "./ChatWindow.css";

// const ChatWindow = ({
//   contract,
//   onSendMessage,
//   onToggleSummary,
//   isSummaryOpen,
//   onUploadSuccess,
// }) => {
//   const [inputValue, setInputValue] = useState("");
//   const [isUploading, setIsUploading] = useState(false);
//   const [stagedFile, setStagedFile] = useState(null);
//   const scrollRef = useRef(null);
//   const fileInputRef = useRef(null);

//   // Auto-scroll to bottom
//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//     }
//   }, [contract?.chatHistory, isUploading]);

//   /**
//    * UPDATED: Handle Send logic for immediate UI feedback (Optimistic Update)
//    */
//   const handleSend = async () => {
//     const hasText = inputValue.trim() !== "";
//     const hasFile = stagedFile !== null;

//     if ((!hasText && !hasFile) || isUploading) return;

//     const currentMessage = inputValue.trim();
//     const currentFile = stagedFile;

//     setInputValue("");
//     setStagedFile(null);

//     if (hasFile) {
//       const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//       const optimisticMsg = {
//         sender: "user",
//         type: "file",
//         fileName: currentFile.name,
//         text: currentMessage || `Uploaded: ${currentFile.name}`,
//         time: currentTime,
//       };
      
//       onSendMessage(optimisticMsg); 
//       await uploadFile(currentFile);
//     } else {
//       onSendMessage(currentMessage);
//     }
//   };

//   /**
//    * UPDATED: Upload Logic
//    */
//   const uploadFile = async (file) => {
//     setIsUploading(true);
//     try {
//       const response = await api.uploadLease(file);
//       onUploadSuccess(file, response.data, !!contract, null); 
//     } catch (error) {
//       console.error("Error uploading file:", error);
//       alert("AI analysis failed. Please check your backend connection.");
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const handleFileChange = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       if (file.type !== "application/pdf") {
//         alert("Please upload a PDF file.");
//         return;
//       }
//       setStagedFile(file);
//     }
//     event.target.value = null;
//   };

//   const triggerUpload = (e) => {
//     e.preventDefault();
//     if (fileInputRef.current) fileInputRef.current.click();
//   };

//   const showWelcome = !contract || !contract.chatHistory || contract.chatHistory.length === 0;

//   return (
//     <div className={`chat-window ${showWelcome ? "is-welcome" : "is-active"}`}>
//       {!showWelcome && (
//         <header className="chat-header">
//           <div className="header-titles">
//             <h3>{contract.carName || "Contract Analysis"}</h3>
//             <span className="file-subtitle">
//               {contract.fileName || "Active Session"}
//             </span>
//           </div>
//           {onToggleSummary && (
//             <button
//               className={`summary-toggle-btn ${isSummaryOpen ? "active" : ""}`}
//               onClick={onToggleSummary}
//               disabled={!contract || !contract.serverFilename}
//             >
//               <PanelRight size={20} />
//             </button>
//           )}
//         </header>
//       )}

//       <div className="chat-container">
//         <div className="chat-content-wrapper" ref={scrollRef}>
//           {showWelcome ? (
//             <div className="welcome-container">
//               <div className="welcome-content">
//                 <div className="logo-badge">
//                   <Sparkles size={40} className="text-teal-400" />
//                 </div>
//                 <h1>How can LeaseIQ help today?</h1>
//                 <p>Attach a contract or just say hello to get started.</p>
//               </div>
//             </div>
//           ) : (
//             <div className="chat-messages">
//               {contract.chatHistory.map((msg, i) => (
//                 <div key={i} className={`message ${msg.sender}`}>
//                   <div className="avatar-header">
//                     <div className={`avatar ${msg.sender === "ai" ? "ai-icon" : "user-icon"}`}>
//                       {msg.sender === "ai" ? "L" : <User size={12} />}
//                     </div>
//                     <span className="sender-name">
//                       {msg.sender === "ai" ? "LeaseIQ" : "You"}
//                     </span>
//                     <span className="timestamp">{msg.time}</span>
//                   </div>
//                   <div className="msg-bubble">
//                     {msg.type === "file" ? (
//                       <div className="file-container">
//                         <div className="file-attachment-bubble">
//                           <FileText size={18} className="text-teal-500" />
//                           <div className="file-details">
//                             <span className="file-name-text">{msg.fileName}</span>
//                             <span className="file-meta">AI Analysis Complete</span>
//                           </div>
//                         </div>
//                         {msg.text && (
//                           <div className="msg-content mt-2 markdown-body">
//                             {/* UPDATED: User messages with files also use Markdown */}
//                             <ReactMarkdown>{msg.text}</ReactMarkdown>
//                           </div>
//                         )}
//                       </div>
//                     ) : (
//                       <div className="msg-content markdown-body">
//                         {/* UPDATED: Standard AI/User text uses Markdown */}
//                         <ReactMarkdown>{msg.text}</ReactMarkdown>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               ))}

//               {isUploading && (
//                 <div className="message ai">
//                   <div className="msg-bubble typing-indicator">
//                     <Loader2 size={14} className="animate-spin" />
//                     <span>Analyzing your document...</span>
//                   </div>
//                 </div>
//               )}
//               <div className="scroll-bottom-spacer" />
//             </div>
//           )}
//         </div>

//         <div className="chat-input-area">
//           <div className="input-wrapper-container">
//             {stagedFile && (
//               <div className="staged-file-preview">
//                 <FileText size={14} />
//                 <span className="staged-name">{stagedFile.name}</span>
//                 <button className="remove-staged-btn" onClick={() => setStagedFile(null)}>
//                   <X size={14} />
//                 </button>
//               </div>
//             )}

//             <div className="input-wrapper">
//               <input
//                 type="file"
//                 ref={fileInputRef}
//                 onChange={handleFileChange}
//                 accept=".pdf"
//                 style={{ display: "none" }}
//               />

//               <button
//                 type="button"
//                 className={`attach-btn ${stagedFile ? "has-file" : ""}`}
//                 onClick={triggerUpload}
//                 disabled={isUploading}
//               >
//                 <Paperclip size={20} />
//               </button>

//               <input
//                 type="text"
//                 placeholder={stagedFile ? "Add a message about this file..." : "Ask LeaseIQ or attach a contract..."}
//                 value={inputValue}
//                 onChange={(e) => setInputValue(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && handleSend()}
//               />

//               <button
//                 className="send-btn"
//                 onClick={handleSend}
//                 disabled={(!inputValue.trim() && !stagedFile) || isUploading}
//               >
//                 {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
//               </button>
//             </div>
//             <p className="disclaimer">
//               LeaseIQ insights are powered by AI. Please verify financial details.
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ChatWindow;

