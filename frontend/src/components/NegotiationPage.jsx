
import React, { useState } from "react";
// REACHING DOWN: Import from the Negotiation subfolder
import ChatWindow from "./Negotiation/ChatWindow"; 
// REACHING ACROSS: Import from the services folder
import {
  uploadContract,
  analyzeContract,
  getAnalysis,
} from "../services/api"; 

const NegotiationPage = () => {
  const [fileId, setFileId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset UI state
    setAnalysis(null);
    setFileId("");
    setStatusMessage("Starting upload...");
    setUploading(true);

    try {
      setStatusMessage("Step 1: Uploading and extracting text...");
      const uploadRes = await uploadContract(file);
      
      // LOGIC FIX: Capture the ID immediately in a local variable 
      // instead of relying on the 'fileId' state which is asynchronous.
      const freshFileId = uploadRes?.file_id;
      
      if (!freshFileId) {
        throw new Error("Backend failed to provide a numeric File ID.");
      }

      setFileId(freshFileId);
      console.log("✅ File uploaded successfully. ID:", freshFileId);

      // Step 2: Analyze
      setStatusMessage("Step 2: AI is analyzing fairness and hidden fees...");
      
      // LOGIC FIX: Pass 'freshFileId' directly to ensure we don't send the stale state.
      const analysisRes = await analyzeContract(freshFileId);
      
      setAnalysis(analysisRes);
      setStatusMessage("Analysis complete. You can now negotiate below.");
    } catch (err) {
      console.error("❌ Negotiation Flow Error:", err);
      const errorDetail = err.response?.data?.detail || err.message;
      setStatusMessage(`Error: ${errorDetail}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeById = async () => {
    const trimmedId = fileId ? String(fileId).trim() : "";
    if (!trimmedId) return;

    setAnalyzing(true);
    setAnalysis(null); 
    setStatusMessage("Loading existing analysis...");

    try {
      // Direct attempt
      const data = await analyzeContract(trimmedId);
      setAnalysis(data);
      setStatusMessage("Analysis refreshed.");
    } catch (err) {
      console.warn("Direct analysis failed, trying fallback...");
      try {
        const existing = await getAnalysis(trimmedId);
        setAnalysis(existing);
        setStatusMessage("Loaded cached analysis.");
      } catch (inner) {
        setStatusMessage("Record not found. Ensure the ID is correct.");
      }
    } finally {
      setAnalyzing(false);
    }
  };

    return (
    <div className="negotiation-view-wrapper custom-scrollbar" style={{ padding: "clamp(10px, 4vw, 20px)", height: "100vh", overflowY: "auto", background: "#0C0E12" }}>
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #0C0E12; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #2D333B; border-radius: 10px; border: 2px solid #0C0E12; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #21CAB9; }
          
          /* Mobile & Tablet Specific Overrides */
          @media (max-width: 1024px) {
            .responsive-grid-top { grid-template-columns: 1fr !important; }
            .responsive-grid-main { grid-template-columns: 1fr !important; }
            .negotiation-view-wrapper { height: auto !important; }
          }
        `}
      </style>
        
      <div style={{ borderRadius: "18px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* --- HEADER SECTION --- */}
        <div style={{ textAlign: "center", padding: "1rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <h1 style={{ fontSize: "clamp(1.25rem, 5vw, 1.75rem)", fontWeight: "600", color: "#fff", margin: 0 }}>
            Negotiation Assistant
          </h1>
          <p style={{ fontSize: "0.95rem", color: "#9ca3af", margin: 0, maxWidth: "500px", lineHeight: "1.5" }}>
            Analyze contracts and get AI-powered negotiation guidance.
          </p>
        </div>
        
        {/* Top Section: Upload & ID Row (Responsive) */}
        <div className="responsive-grid-top" style={{ display: "grid", gridTemplateColumns: "1.6fr 1.3fr", gap: "12px" }}>
          <div style={{ background: "#161b22", borderRadius: "12px", padding: "16px", border: "1px solid rgba(75,85,99,0.9)" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "12px", color: "#fff" }}>New Analysis</div>
            <label style={{
              display: "inline-flex",
              padding: "10px 20px",
              borderRadius: "999px",
              background: uploading ? "#475569" : "#21CAB9",
              cursor: uploading ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              color: "#111",
              fontWeight: 600
            }}>
              {uploading ? "Processing..." : "Upload PDF"}
              <input type="file" style={{ display: "none" }} onChange={handleFileUpload} disabled={uploading} accept=".pdf" />
            </label>
          </div>
          
          <div style={{ background: "#161b22", borderRadius: "12px", padding: "16px", border: "1px solid rgba(75,85,99,0.9)" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "12px", color: "#fff" }}>Retrieve by ID</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                type="text" 
                value={fileId || ""}
                onChange={(e) => setFileId(e.target.value)}
                placeholder="ID (e.g. 58)" 
                style={{ flex: 1, background: "#0d1117", border: "1px solid #4b5563", borderRadius: "999px", padding: "8px 12px", color: "white", fontSize: "0.85rem", width: "100%" }}
              />
              <button onClick={handleAnalyzeById} disabled={analyzing || !fileId} style={{ background: "#21CAB9", color: "#111", borderRadius: "999px", padding: "8px 16px", fontWeight: 700, cursor: "pointer", border: "none" }}>
                {analyzing ? "..." : "Load"}
              </button>
            </div>
          </div>
        </div>
          
        {/* MAIN SECTION: Chat & Summary (Responsive) */}
        <div className="responsive-grid-main" style={{ 
          display: "grid", 
          gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2.1fr)", 
          gap: "14px",
          alignItems: "start"
        }}>
           <ChatWindow fileId={fileId} analysis={analysis} />
        </div>
      </div>
    </div>
  );
};

export default NegotiationPage;













// import React, { useState } from "react";
// // REACHING DOWN: Import from the Negotiation subfolder
// import ChatWindow from "./Negotiation/ChatWindow"; 
// // REACHING ACROSS: Import from the services folder
// import {
//   uploadContract,
//   analyzeContract,
//   getAnalysis,
// } from "../services/api"; 

// const NegotiationPage = () => {
//   const [fileId, setFileId] = useState("");
//   const [analysis, setAnalysis] = useState(null);
//   const [uploading, setUploading] = useState(false);
//   const [analyzing, setAnalyzing] = useState(false);
//   const [statusMessage, setStatusMessage] = useState("");

//   const handleFileUpload = async (event) => {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     // Reset UI state
//     setAnalysis(null);
//     setFileId("");
//     setStatusMessage("Starting upload...");
//     setUploading(true);

//     try {
//       setStatusMessage("Step 1: Uploading and extracting text...");
//       const uploadRes = await uploadContract(file);
      
//       // LOGIC FIX: Capture the ID immediately in a local variable 
//       // instead of relying on the 'fileId' state which is asynchronous.
//       const freshFileId = uploadRes?.file_id;
      
//       if (!freshFileId) {
//         throw new Error("Backend failed to provide a numeric File ID.");
//       }

//       setFileId(freshFileId);
//       console.log("✅ File uploaded successfully. ID:", freshFileId);

//       // Step 2: Analyze
//       setStatusMessage("Step 2: AI is analyzing fairness and hidden fees...");
      
//       // LOGIC FIX: Pass 'freshFileId' directly to ensure we don't send the stale state.
//       const analysisRes = await analyzeContract(freshFileId);
      
//       setAnalysis(analysisRes);
//       setStatusMessage("Analysis complete. You can now negotiate below.");
//     } catch (err) {
//       console.error("❌ Negotiation Flow Error:", err);
//       const errorDetail = err.response?.data?.detail || err.message;
//       setStatusMessage(`Error: ${errorDetail}`);
//     } finally {
//       setUploading(false);
//     }
//   };

//   const handleAnalyzeById = async () => {
//     const trimmedId = fileId ? String(fileId).trim() : "";
//     if (!trimmedId) return;

//     setAnalyzing(true);
//     setAnalysis(null); 
//     setStatusMessage("Loading existing analysis...");

//     try {
//       // Direct attempt
//       const data = await analyzeContract(trimmedId);
//       setAnalysis(data);
//       setStatusMessage("Analysis refreshed.");
//     } catch (err) {
//       console.warn("Direct analysis failed, trying fallback...");
//       try {
//         const existing = await getAnalysis(trimmedId);
//         setAnalysis(existing);
//         setStatusMessage("Loaded cached analysis.");
//       } catch (inner) {
//         setStatusMessage("Record not found. Ensure the ID is correct.");
//       }
//     } finally {
//       setAnalyzing(false);
//     }
//   };

//   return (
//     <div className="negotiation-view-wrapper" style={{ padding: "20px", height: "100%", overflowY: "auto", background:"#0C0E12" }}>
//       {/* Container Card */}
//       <div style={{
        
//         borderRadius: "18px",
//         display: "flex",
//         flexDirection: "column",
//         gap: "16px"
//       }}>
        
//         {/* Top Section: Upload & ID Row */}
//         <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.3fr", gap: "12px" }}>
//           <div style={{ background:" #161b22", borderRadius: "12px", padding: "16px", border: "1px solid rgba(75,85,99,0.9)" }}>
//             <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "12px", color: "#fff" }}>New Analysis</div>
//             <label style={{
//               display: "inline-flex",
//               padding: "10px 20px",
//               borderRadius: "999px",
//               background: uploading ? "#475569" : "#21CAB9",
//               cursor: uploading ? "not-allowed" : "pointer",
//               fontSize: "0.85rem",
//               color:"#111",
//               fontWeight: 600,
//               transition: "opacity 0.2s"
//             }}>
//               {uploading ? "Processing..." : "Upload PDF Contract"}
//               <input type="file" style={{ display: "none" }} onChange={handleFileUpload} disabled={uploading} accept=".pdf" />
//             </label>
//             {statusMessage && (
//                <p style={{ 
//                  fontSize: "0.75rem", 
//                  color: statusMessage.includes("Error") ? "#f87171" : "#9ca3af", 
//                  marginTop: "12px" 
//                }}>
//                  {statusMessage}
//                </p>
//             )}
//           </div>

//           <div style={{ background: "#161b22", borderRadius: "12px", padding: "16px", border: "1px solid rgba(75,85,99,0.9)" }}>
//             <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "12px", color: "#fff" }}>Retrieve by ID</div>
//             <div style={{ display: "flex", gap: "8px" }}>
//               <input 
//                 type="text" 
//                 value={fileId || ""}
//                 onChange={(e) => setFileId(e.target.value)}
//                 placeholder="Enter Numeric ID (e.g. 58)" 
//                 style={{ flex: 1, background: "#0d1117", border: "1px solid #4b5563", borderRadius: "999px", padding: "8px 12px", color: "white", fontSize: "0.85rem" }}
//               />
//               <button 
//                 onClick={handleAnalyzeById} 
//                 disabled={analyzing || !fileId}
//                 style={{ background: "#21CAB9", color: "#111", borderRadius: "999px", padding: "8px 16px", fontWeight: 700, cursor: "pointer", border: "none" }}
//               >
//                 {analyzing ? "..." : "Load"}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* MIDDLE SECTION: Layout Fix
//             This keeps the Chat and Summary side-by-side using the correct grid proportions.
//         */}
//         <div style={{ 
//           display: "grid", 
//           gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2.1fr)", 
//           gap: "14px",
//           alignItems: "start",
//           marginTop: "10px"
//         }}>
//            <ChatWindow fileId={fileId} analysis={analysis} />
//         </div>
//       </div>
//     </div>
//   );
// };

// export default NegotiationPage;