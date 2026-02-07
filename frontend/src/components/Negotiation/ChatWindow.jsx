
import React, { useState } from "react";
import MessageBubble from "./MessageBubble";

// FIX: Import sendChat from our unified services/api
import { sendChat } from "../../services/api"; 

export default function ChatWindow({ fileId, analysis }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

  const handleSend = async (intent = "chat") => {
    // If we're generating an email, use a default prompt if input is empty
    const messageContent = intent === "email" && !input.trim() 
      ? "Please generate a professional negotiation email draft based on this analysis." 
      : input;

    if (!messageContent.trim() || !fileId) return;

    const userMessage = { role: "user", content: messageContent };
    const newHistory = [...messages, userMessage];
    
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      // Calls the backend through our api.js sendChat function
      const res = await sendChat(fileId, messageContent, newHistory, intent);
      
      const assistantMsg = {
        role: "assistant",
        content: res.assistant_message,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.counter_email_draft) {
        setEmailDraft(res.counter_email_draft);
        // Optional: Also add the draft as an assistant message so user can see it
        setMessages((prev) => [
          ...prev, 
          { role: "assistant", content: "### Negotiation Email Draft\n\n" + res.counter_email_draft }
        ]);
      }
    } catch (err) {
      console.error("❌ Negotiation Chat Error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error talking to server. Ensure the backend is running and the File ID is valid." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ... rest of your return JSX remains exactly the same ...
return (
    <>
      {/* Global Scrollbar CSS Injection */}
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #374151; /* Slate-700 */
            border-radius: 20px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #21CAB9; /* Your Brand Teal */
          }
          /* For Firefox */
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #374151 transparent;
          }
        `}
      </style>

      {/* Chat panel */}
      <div
        style={{
          background: "#161b22",
          borderRadius: "12px",
          border: "1px solid rgba(55,65,81,0.9)",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          height: "420px",
        }}
      >
        {/* Added "custom-scrollbar" class here */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            marginBottom: "8px",
            padding: "6px 4px",
            background: "#0d1117",
            borderRadius: "8px",
            border: "1px solid rgba(31,41,55,0.9)",
          }}
        >
          {messages.length === 0 && (
            <p style={{ fontSize: "0.8rem", color: "#6b7280", padding: "4px 2px" }}>
              Ask about penalties, interest rate risk, hidden fees, or request a negotiation email draft.
            </p>
          )}
          {messages.map((m, idx) => (
            <MessageBubble key={idx} role={m.role} content={m.content} />
          ))}
        </div>

        {/* Input Area */}
        <div style={{ display: "flex", gap: "8px" }}>
          <textarea
            className="custom-scrollbar" // Added scrollbar style to textarea too
            style={{
              flex: 1,
              resize: "none",
              height: "58px",
              fontSize: "0.82rem",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid rgba(75,85,99,0.9)",
              background: "#0d1117",
              color: "#e5e7eb",
              outline: "none",
            }}
            placeholder={fileId ? "Type a question or ask for a counter email..." : "Upload a contract first."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!fileId || loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend("chat");
              }
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "130px" }}>
            <button
              onClick={() => handleSend("chat")}
              disabled={loading || !fileId}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.8rem",
                fontWeight: 600,
                background: "#21CAB9",
                color: "#111",
                cursor: loading || !fileId ? "not-allowed" : "pointer",
                opacity: loading || !fileId ? 0.6 : 1,
              }}
            >
              {loading ? "Sending..." : "Send"}
            </button>
            <button
              onClick={() => handleSend("email")}
              disabled={loading || !fileId}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: " 1px solid rgba(33, 202, 185, 0.4)",
                fontSize: "0.8rem",
                fontWeight: 600,
                background: " rgba(33, 202, 185, 0.15)",
                color: "#21CAB9",
                cursor: loading || !fileId ? "not-allowed" : "pointer",
                opacity: loading || !fileId ? 0.6 : 1,
              }}
            >
              {loading ? "Generating..." : "Generate Email"}
            </button>
          </div>
        </div>
      </div>

      {/* Fairness Summary (Right Side) */}
      <div style={{
          background: "#161b22",
          borderRadius: "12px",
          border: "1px solid rgba(55,65,81,0.9)",
          padding: "10px 12px",
          fontSize: "0.82rem",
          height: "420px",
          display: "flex",
          flexDirection: "column",
        }}>
        <div style={{ fontWeight: 600, marginBottom: "6px" }}>Fairness Summary</div>
        {analysis ? (
          <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{
                padding: "8px",
                margin: "10px",
                borderRadius: "10px",
                background: analysis.fairness.rating === "Good" || analysis.fairness.rating === "Fair"
                  ? "rgba(33, 202, 185, 0.15)"
                  : analysis.fairness.rating === "Moderate"
                  ? "rgba(255, 179, 64, 0.15)"
                  : "rgba(248, 81, 73, 0.15)",
                color: analysis.fairness.rating === "Good" || analysis.fairness.rating === "Fair"
                  ? "#21CAB9"
                  : analysis.fairness.rating === "Moderate"
                  ? "#ffb340"
                  : "#f85149",
                border: analysis.fairness.rating === "Good" || analysis.fairness.rating === "Fair"
                  ? "1px solid rgba(33, 202, 185, 0.4)"
                  : analysis.fairness.rating === "Moderate"
                  ? "1px solid rgba(255, 179, 64, 0.4)"
                  : "1px solid rgba(248, 81, 73, 0.4)",
                marginBottom: "8px",
              }}>
              <div style={{ fontSize: "0.86rem", fontWeight: 600, margin: "10px", }}>
                Score: {analysis.fairness.score} ({analysis.fairness.rating})
              </div>
              <div style={{ fontSize: "0.78rem", marginTop: "2px", margin: "10px", }}>
                {analysis.fairness.explanation}
              </div>
            </div>
            <div style={{ marginBottom: "6px" }}>
              <div style={{ margin: "10px" }}><strong>Hidden fees:</strong> {analysis.hidden_fees?.length || 0}</div>
              <div style={{ margin: "10px" }}><strong>Risk factors:</strong> {analysis.risk_factors?.length || 0}</div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            No analysis loaded yet.
          </p>
        )}
      </div>
    </>
  );
}












// import React, { useState } from "react";
// import MessageBubble from "./MessageBubble";

// // FIX: Import sendChat from our unified services/api
// import { sendChat } from "../../services/api"; 

// export default function ChatWindow({ fileId, analysis }) {
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [emailDraft, setEmailDraft] = useState("");

//   const handleSend = async (intent = "chat") => {
//     // If we're generating an email, use a default prompt if input is empty
//     const messageContent = intent === "email" && !input.trim() 
//       ? "Please generate a professional negotiation email draft based on this analysis." 
//       : input;

//     if (!messageContent.trim() || !fileId) return;

//     const userMessage = { role: "user", content: messageContent };
//     const newHistory = [...messages, userMessage];
    
//     setMessages(newHistory);
//     setInput("");
//     setLoading(true);

//     try {
//       // Calls the backend through our api.js sendChat function
//       const res = await sendChat(fileId, messageContent, newHistory, intent);
      
//       const assistantMsg = {
//         role: "assistant",
//         content: res.assistant_message,
//       };

//       setMessages((prev) => [...prev, assistantMsg]);

//       if (res.counter_email_draft) {
//         setEmailDraft(res.counter_email_draft);
//         // Optional: Also add the draft as an assistant message so user can see it
//         setMessages((prev) => [
//           ...prev, 
//           { role: "assistant", content: "### Negotiation Email Draft\n\n" + res.counter_email_draft }
//         ]);
//       }
//     } catch (err) {
//       console.error("❌ Negotiation Chat Error:", err);
//       setMessages((prev) => [
//         ...prev,
//         { role: "assistant", content: "Error talking to server. Ensure the backend is running and the File ID is valid." },
//       ]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ... rest of your return JSX remains exactly the same ...
//   return (
//     <>
//       {/* Chat panel */}
//       <div
//         style={{
//           background:" #161b22",
//           borderRadius: "12px",
//           border: "1px solid rgba(55,65,81,0.9)",
//           padding: "10px 12px",
//           display: "flex",
//           flexDirection: "column",
//           height: "420px",
//         }}
//       >
//         {/* ... Header and Message List UI ... */}
//         <div
//           style={{
//             flex: 1,
//             overflowY: "auto",
//             marginBottom: "8px",
//             padding: "6px 4px",
//             // background: "#020617",
//             background: "#0d1117",
//             borderRadius: "8px",
//             border: "1px solid rgba(31,41,55,0.9)",
//           }}
//         >
//           {messages.length === 0 && (
//             <p style={{ fontSize: "0.8rem", color: "#6b7280", padding: "4px 2px" }}>
//               Ask about penalties, interest rate risk, hidden fees, or request a negotiation email draft.
//             </p>
//           )}
//           {messages.map((m, idx) => (
//             <MessageBubble key={idx} role={m.role} content={m.content} />
//           ))}
//         </div>

//         {/* Input Area */}
//         <div style={{ display: "flex", gap: "8px" }}>
//           <textarea
//             style={{
//               flex: 1,
//               resize: "none",
//               height: "58px",
//               fontSize: "0.82rem",
//               padding: "10px",
//               borderRadius: "8px",
//               border: "1px solid rgba(75,85,99,0.9)",
//               // backgroundColor: "#020617",
//               background: "#0d1117",
//               color: "#e5e7eb",
//               outline: "none",
//             }}
//             placeholder={fileId ? "Type a question or ask for a counter email..." : "Upload a contract first."}
//             value={input}
//             onChange={(e) => setInput(e.target.value)}
//             disabled={!fileId || loading}
//           />
//           <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "130px" }}>
//             <button
//               onClick={() => handleSend("chat")}
//               disabled={loading || !fileId}
//               style={{
//                 padding: "6px 10px",
//                 borderRadius: "8px",
//                 border: "none",
//                 fontSize: "0.8rem",
//                 fontWeight: 600,
//                 background: "#21CAB9",
//                 color: "#111",
//                 cursor: loading || !fileId ? "not-allowed" : "pointer",
//                 opacity: loading || !fileId ? 0.6 : 1,
//               }}
//             >
//               {loading ? "Sending..." : "Send"}
//             </button>
//             <button
//               onClick={() => handleSend("email")}
//               disabled={loading || !fileId}
//               style={{
//                 padding: "6px 10px",
//                 borderRadius: "8px",
//                 border: " 1px solid rgba(33, 202, 185, 0.4)",
//                 fontSize: "0.8rem",
//                 fontWeight: 600,
//                 background: " rgba(33, 202, 185, 0.15)",
//                 color: "#21CAB9",
//                 cursor: loading || !fileId ? "not-allowed" : "pointer",
//                 opacity: loading || !fileId ? 0.6 : 1,
//               }}
//             >
//               {loading ? "Generating..." : "Generate Email"}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Fairness Summary (Right Side) */}
//       <div style={{
//           background:" #161b22",
//           borderRadius: "12px",
//           border: "1px solid rgba(55,65,81,0.9)",
//           padding: "10px 12px",
//           fontSize: "0.82rem",
//           height: "420px",
//           display: "flex",
//           flexDirection: "column",
//         }}>
//         <div style={{ fontWeight: 600, marginBottom: "6px" }}>Fairness Summary</div>
//         {analysis ? (
//           <>
//             <div style={{
//                 padding: "8px",
//                 margin:"10px",
//                 borderRadius: "10px",
//                 background: analysis.fairness.rating === "Good" || analysis.fairness.rating === "Fair"
//                   ? "rgba(33, 202, 185, 0.15)" // Your .good color
//                   : analysis.fairness.rating === "Moderate"
//                   ? "rgba(255, 179, 64, 0.15)" // Your .fair color
//                   : "rgba(248, 81, 73, 0.15)",
//                 color: analysis.fairness.rating === "Good" || analysis.fairness.rating === "Fair"
//                   ? "#21CAB9"
//                   : analysis.fairness.rating === "Moderate"
//                   ? "#ffb340"
//                   : "#f85149",
//                 border: analysis.fairness.rating === "Good" || analysis.fairness.rating === "Fair"
//                   ? "1px solid rgba(33, 202, 185, 0.4)"
//                   : analysis.fairness.rating === "Moderate"
//                   ? "1px solid rgba(255, 179, 64, 0.4)"
//                   : "1px solid rgba(248, 81, 73, 0.4)",
//                 marginBottom: "8px",
//               }}>
//               <div style={{ fontSize: "0.86rem", fontWeight: 600, margin:"10px", }}>
//                 Score: {analysis.fairness.score} ({analysis.fairness.rating})
//               </div>
//               <div style={{ fontSize: "0.78rem", marginTop: "2px", margin:"10px", }}>
//                 {analysis.fairness.explanation}
//               </div>
//             </div>
//             <div style={{ marginBottom: "6px" }}>
//               <div style={{margin:"10px"}}><strong>Hidden fees:</strong> {analysis.hidden_fees?.length || 0}</div>
//               <div style={{margin:"10px"}}><strong>Risk factors:</strong> {analysis.risk_factors?.length || 0}</div>
//             </div>
//           </>
//         ) : (
//           <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
//             No analysis loaded yet.
//           </p>
//         )}
//       </div>
//     </>
//   );
// }