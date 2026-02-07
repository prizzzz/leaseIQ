


import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SummaryPanel from "./components/SummaryPanel";
import VinPriceCheck from "./components/VinPriceCheck";
import ContractComparison from "./components/ContractComparison";
import NegotiationPage from "./components/NegotiationPage";
import DealerSimulator from "./components/DealerSimulator"; // NEW: Import the Simulator
import Login from "./components/Login";
import Header from "./components/Header";
import { api } from "./services/api";
import "./App.css";

function App() {
  // --- Authentication State ---
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user_session");
    // Check if token exists in localStorage alongside user data
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // --- History & Active Contract State ---
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("app_history");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeContract, setActiveContract] = useState(() => {
    const savedId = localStorage.getItem("active_id");
    if (savedId) {
      const savedHistory = JSON.parse(localStorage.getItem("app_history") || "[]");
      return savedHistory?.find((c) => c.id.toString() === savedId) || null;
    }
    return null;
  });

  // --- UI View State ---
  const [view, setView] = useState(() => localStorage.getItem("app_view") || "chat");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // --- LocalStorage Sync ---
  useEffect(() => {
    localStorage.setItem("app_history", JSON.stringify(history));
    localStorage.setItem("app_view", view);
    if (user) localStorage.setItem("user_session", JSON.stringify(user));
    if (activeContract) localStorage.setItem("active_id", activeContract.id.toString());
  }, [history, activeContract, view, user]);

  useEffect(() => {
  const fetchUserHistory = async () => {
      if (user && user.id) {
        try {
          const response = await fetch(`http://localhost:5000/api/leases/${user.id}`);
          const data = await response.json();

          // 1. Update the sidebar history
          setHistory(data);

          // 2. CRITICAL: Re-sync the active contract with the fresh DB data
          const savedId = localStorage.getItem("active_id");
          if (savedId) {
            const freshActive = data.find((c) => c.id.toString() === savedId);
            if (freshActive) {
              setActiveContract(freshActive);
            }
          }
        } catch (err) {
          console.error("Failed to load history from DB", err);
        }
      }
    };
    fetchUserHistory();
  }, [user]);
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user_session");
    localStorage.removeItem("token"); // Explicitly remove the JWT
    localStorage.removeItem("active_id");
    localStorage.removeItem("app_view");
    // Don't clear EVERYTHING if you want to keep app_history for the next user
    setActiveContract(null);
    setHistory([]);
    setView("chat");
  };

  // --- Message History Management ---
  const addMessageToHistory = (contractId, message) => {
    const updateLogic = (prev) =>
      prev.map((c) => {
        if (c.id === contractId) {
          let newChatHistory = [...c.chatHistory];

          // 1. Handle updating an existing message (AI Streaming)
          if (message.isUpdate) {
            let found = false;
            newChatHistory = newChatHistory.map((m) => {
              if (!found && (m.id === message.id || (m.sender === "ai" && m.isStreaming))) {
                found = true;
                return { 
                  ...m, 
                  text: message.text, 
                  isStreaming: message.isStreaming !== false 
                };
              }
              return m;
            });
          } else {
            // 2. Add a brand new message (User message or AI start)
            newChatHistory.push(message);
          }

          // Create the updated contract object
          const updatedContract = { ...c, chatHistory: newChatHistory };

          // --- PERSISTENCE LOGIC ---
          // Save to DB in two cases:
          // A. It's a User message (Save immediately)
          // B. It's an AI message and it has FINISHED streaming (isStreaming is false)
          if (message.sender === "user" || (message.sender === "ai" && message.isStreaming === false)) {
            saveContractToDb(updatedContract);
          }

          return updatedContract;
        }
        return c;
      });

    // Update the full history list
    setHistory(updateLogic);

    // Update the currently viewed contract
    setActiveContract((prev) => {
      if (prev && prev.id === contractId) {
        const result = updateLogic([prev]);
        return result[0];
      }
      return prev;
    });
  };

  // --- Centralized Messaging Logic ---
  const sendMessage = async (input, targetContract = null) => {
    // 1. Handle streaming/UI updates (don't save these to DB until they are finished)
    if (typeof input === 'object' && (input.isUpdate || input.isStreaming)) {
      const targetId = targetContract?.id || activeContract?.id;
      if (targetId) addMessageToHistory(targetId, input);
      return;
    }

    const isObject = typeof input === 'object';
    const text = isObject ? input.text : input;
    if (!text?.trim() && !isObject) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    // Create the new message object
    const userMsg = isObject ? input : { 
      id: Date.now(), 
      sender: "user", 
      text: text.trim(), 
      time: currentTime 
    };

    let currentContract = targetContract || activeContract;

    if (!currentContract) {
      // --- CASE A: STARTING A NEW CHAT ---
      const newId = Date.now();
      const newChat = {
        id: newId,
        carName: isObject && input.type === 'file' ? input.fileName : "New Conversation", 
        fileName: isObject && input.type === 'file' ? input.fileName : "General Inquiry",
        serverFilename: null,
        date: new Date().toLocaleDateString(),
        summary: {},
        chatHistory: [userMsg],
      };

      // Update UI state
      setHistory((prev) => [newChat, ...prev]);
      setActiveContract(newChat);

      // SAVE TO POSTGRES
      saveContractToDb(newChat); 
      
      return newChat; 
    } else {
      // --- CASE B: UPDATING AN EXISTING CHAT ---
      
      // Update UI state (This handles the sidebar/chat window display)
      addMessageToHistory(currentContract.id, userMsg);

      // Create a copy of the contract with the new message to send to the DB
      const updatedContract = { 
        ...currentContract, 
        chatHistory: [...currentContract.chatHistory, userMsg] 
      };

      // SAVE TO POSTGRES
      saveContractToDb(updatedContract);

      return currentContract; 
    }
  };

  // --- Feature Handlers ---
  const handleVinCheck = async (vin, price) => {
    try {
      const response = await api.getMarketAnalysis(vin, price);
      return response.data;
    } catch (error) {
      console.error("❌ Market Check Error:", error);
      throw new Error("Server unreachable.");
    }
  };

  const saveContractToDb = async (contractData) => {
    // Safety check: Don't try to save if we don't have a user session
    if (!user || !user.id) {
      console.warn("⚠️ Cannot save: No user ID found.");
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/leases/save', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          userId: user.id, 
          data: contractData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save to database");
      }

      console.log(`✅ ${contractData.carName} synced to PostgreSQL`);
    } catch (err) {
      console.error("❌ DB Sync Error:", err.message);
    }
  };

  const handleUploadSuccess = async (file, backendResult) => {
    const serverFileName = backendResult.filename;
    const extractionData = backendResult.data;

    const vehicleTitle = extractionData?.make && extractionData?.model
        ? `${extractionData.make} ${extractionData.model}`
        : extractionData?.vin || file.name.split(".")[0];

    const updateData = {
      carName: vehicleTitle,
      serverFilename: serverFileName,
      summary: { ...extractionData },
    };

    // 1. Update local UI state immediately
    setHistory((prev) => prev.map((c) => (c.id === activeContract?.id ? { ...c, ...updateData } : c)));
    
    setActiveContract((prev) => {
      const newActive = { ...prev, ...updateData };
      
      // 2. Trigger the Database Save with the fresh data
      saveContractToDb(newActive); 
      
      setIsSummaryOpen(true); 
      return newActive;
    });

    return { serverFilename: serverFileName };
  };

  const handleDeleteLease = async (e, id) => {
    e.stopPropagation(); 
    
    // 1. Instant UI update (Optimistic UI)
    setHistory((h) => h.filter((i) => i.id !== id)); 
    if (activeContract?.id === id) setActiveContract(null); 

    // 2. Database update
    try {
      const response = await fetch(`http://localhost:5000/api/leases/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error("Failed to delete from DB");
      console.log("🗑️ Lease deleted from database permanently");
    } catch (err) {
      console.error("❌ Delete Error:", err);
      // Optional: alert user or refresh history if delete failed
    }
  };


  if (!user) return <Login onLoginSuccess={(token, userData) => setUser(userData)} />;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  return (
    // <div className="app-container">
    <div className={`app-container ${isSidebarOpen ? "sidebar-mobile-open" : ""}`}>
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      <Sidebar 
        history={history.filter((i) => i.carName.toLowerCase().includes(searchTerm.toLowerCase()))} 
        activeId={activeContract?.id} 
        onSelect={(c) => { 
          setActiveContract(c); 
          setView("chat"); 
          setIsSummaryOpen(false); 
          setIsSidebarOpen(false);
        }} 
        onDelete={handleDeleteLease} 
        onNewChat={() => { 
          setActiveContract(null); 
          setView("chat"); 
          setIsSummaryOpen(false); 
          setIsSidebarOpen(false);
        }}
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm} 
        view={view} 
        setView={(v) => { setView(v); setIsSidebarOpen(false); }} 
        onCloseSidebar={() => setIsSidebarOpen(false)}
      />

      <div className="content-area-wrapper">
        <Header 
          user={user} 
          onLogout={handleLogout} 
          activeContract={activeContract} 
          onToggleSummary={() => setIsSummaryOpen(!isSummaryOpen)} 
          isSummaryOpen={isSummaryOpen} 
          view={view} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="main-view-container">
          {/* Chat View */}
          {view === "chat" && (
            <ChatWindow 
              key={activeContract?.id || "new_chat"} 
              contract={activeContract} 
              onSendMessage={sendMessage} 
              onUploadSuccess={handleUploadSuccess} 
            />
          )}

          {/* Negotiation View */}
          {view === "negotiation" && <NegotiationPage key="neg_page" />}

          {/* Comparison View */}
          {view === "comparison" && (
            <ContractComparison key="comp_page" activeContract={activeContract} />
          )}

          {/* NEW: Dealer Simulator View */}
          {view === "simulator" && (
            <DealerSimulator 
              key="sim_page" 
              activeContract={activeContract} 
            />
          )}

          {/* VIN Check View */}
          {view === "vin" && (
            <VinPriceCheck
              key="fixed_vin_price_check" // Change from activeContract?.id to a fixed string
              initialVin={activeContract?.summary?.vin || ""}
              initialPrice={activeContract?.summary?.purchasePrice || ""}
              onCheck={handleVinCheck}
            />
          )}
        </main>
      </div>

      {isSummaryOpen && activeContract && (
        <SummaryPanel 
          summary={activeContract.summary || {}} 
          carName={activeContract.carName || "Vehicle Analysis"} 
          onClose={() => setIsSummaryOpen(false)} 
        />
      )}
    </div>
  );
}

export default App;




















































// import React, { useState, useEffect } from "react";
// import Sidebar from "./components/Sidebar";
// import ChatWindow from "./components/ChatWindow";
// import SummaryPanel from "./components/SummaryPanel";
// import VinPriceCheck from "./components/VinPriceCheck";
// import ContractComparison from "./components/ContractComparison";
// import NegotiationPage from "./components/NegotiationPage";
// import DealerSimulator from "./components/DealerSimulator"; // NEW: Import the Simulator
// import Login from "./components/Login";
// import Header from "./components/Header";
// import { api } from "./services/api";
// import "./App.css";

// function App() {
//   // --- Authentication State ---
//   const [user, setUser] = useState(() => {
//     const savedUser = localStorage.getItem("user_session");
//     // Check if token exists in localStorage alongside user data
//     return savedUser ? JSON.parse(savedUser) : null;
//   });

//   // --- History & Active Contract State ---
//   const [history, setHistory] = useState(() => {
//     const saved = localStorage.getItem("app_history");
//     return saved ? JSON.parse(saved) : [];
//   });

//   const [activeContract, setActiveContract] = useState(() => {
//     const savedId = localStorage.getItem("active_id");
//     if (savedId) {
//       const savedHistory = JSON.parse(localStorage.getItem("app_history") || "[]");
//       return savedHistory?.find((c) => c.id.toString() === savedId) || null;
//     }
//     return null;
//   });

//   // --- UI View State ---
//   const [view, setView] = useState(() => localStorage.getItem("app_view") || "chat");
//   const [searchTerm, setSearchTerm] = useState("");
//   const [isSummaryOpen, setIsSummaryOpen] = useState(false);

//   // --- LocalStorage Sync ---
//   useEffect(() => {
//     localStorage.setItem("app_history", JSON.stringify(history));
//     localStorage.setItem("app_view", view);
//     if (user) localStorage.setItem("user_session", JSON.stringify(user));
//     if (activeContract) localStorage.setItem("active_id", activeContract.id.toString());
//   }, [history, activeContract, view, user]);

//   const handleLogout = () => {
//     setUser(null);
//     localStorage.removeItem("user_session");
//     localStorage.removeItem("token"); // Explicitly remove the JWT
//     localStorage.removeItem("active_id");
//     localStorage.removeItem("app_view");
//     // Don't clear EVERYTHING if you want to keep app_history for the next user
//     setActiveContract(null);
//     setHistory([]);
//     setView("chat");
//   };

//   // --- Message History Management ---
//   const addMessageToHistory = (contractId, message) => {
//     const updateLogic = (prev) => prev.map((c) => {
//       if (c.id === contractId) {
//         let newChatHistory = [...c.chatHistory];
//         if (message.isUpdate) {
//           let found = false;
//           newChatHistory = newChatHistory.map(m => {
//             if (!found && (m.id === message.id || (m.sender === "ai" && m.isStreaming))) {
//               found = true;
//               return { ...m, text: message.text, isStreaming: message.isStreaming !== false };
//             }
//             return m;
//           });
//         } else {
//           newChatHistory.push(message);
//         }
//         return { ...c, chatHistory: newChatHistory };
//       }
//       return c;
//     });

//     setHistory(updateLogic);
//     setActiveContract(prev => {
//       if (prev && prev.id === contractId) {
//         const result = updateLogic([prev]);
//         return result[0];
//       }
//       return prev;
//     });
//   };

//   // --- Centralized Messaging Logic ---
//   const sendMessage = async (input, targetContract = null) => {
//     if (typeof input === 'object' && (input.isUpdate || input.isStreaming)) {
//       const targetId = targetContract?.id || activeContract?.id;
//       if (targetId) addMessageToHistory(targetId, input);
//       return;
//     }
  
//     const isObject = typeof input === 'object';
//     const text = isObject ? input.text : input;
//     if (!text?.trim() && !isObject) return;
  
//     const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//     const userMsg = isObject ? input : { 
//       id: Date.now(), 
//       sender: "user", 
//       text: text.trim(), 
//       time: currentTime 
//     };
  
//     let currentContract = targetContract || activeContract;
  
//     if (!currentContract) {
//       const newId = Date.now();
//       const newChat = {
//         id: newId,
//         carName: isObject && input.type === 'file' ? input.fileName : "New Conversation", 
//         fileName: isObject && input.type === 'file' ? input.fileName : "General Inquiry",
//         serverFilename: null,
//         date: new Date().toLocaleDateString(),
//         summary: {},
//         chatHistory: [userMsg],
//       };
//       setHistory((prev) => [newChat, ...prev]);
//       setActiveContract(newChat);
//       return newChat; 
//     } else {
//       addMessageToHistory(currentContract.id, userMsg);
//       return currentContract; 
//     }
//   };

//   // --- Feature Handlers ---
//   const handleVinCheck = async (vin, price) => {
//     try {
//       const response = await api.getMarketAnalysis(vin, price);
//       return response.data;
//     } catch (error) {
//       console.error("❌ Market Check Error:", error);
//       throw new Error("Server unreachable.");
//     }
//   };

//   const handleUploadSuccess = (file, backendResult) => {
//     const serverFileName = backendResult.filename;
//     const extractionData = backendResult.data;

//     const vehicleTitle = extractionData?.make && extractionData?.model
//         ? `${extractionData.make} ${extractionData.model}`
//         : extractionData?.vin || file.name.split(".")[0];

//     const updateData = {
//       carName: vehicleTitle,
//       serverFilename: serverFileName,
//       summary: { ...extractionData },
//     };

//     setHistory((prev) => prev.map((c) => (c.id === activeContract?.id ? { ...c, ...updateData } : c)));
//     setActiveContract((prev) => {
//       const newActive = { ...prev, ...updateData };
//       // 3. Only open the panel once we are sure newActive has the data
//       setIsSummaryOpen(true); 
//       return newActive;
//     });

//     return { serverFilename: serverFileName };
//   };

//   if (!user) return <Login onLoginSuccess={(token, userData) => setUser(userData)} />;

//   return (
//     <div className="app-container">
//       <Sidebar 
//         history={history.filter((i) => i.carName.toLowerCase().includes(searchTerm.toLowerCase()))} 
//         activeId={activeContract?.id} 
//         onSelect={(c) => { 
//           setActiveContract(c); 
//           setView("chat"); 
//           setIsSummaryOpen(false); 
//         }} 
//         onDelete={(e, id) => { 
//           e.stopPropagation(); 
//           setHistory((h) => h.filter((i) => i.id !== id)); 
//           if (activeContract?.id === id) setActiveContract(null); 
//         }} 
//         onNewChat={() => { 
//           setActiveContract(null); 
//           setView("chat"); 
//           setIsSummaryOpen(false); 
//         }} 
//         searchTerm={searchTerm} 
//         setSearchTerm={setSearchTerm} 
//         view={view} 
//         setView={setView} 
//       />

//       <div className="content-area-wrapper">
//         <Header 
//           user={user} 
//           onLogout={handleLogout} 
//           activeContract={activeContract} 
//           onToggleSummary={() => setIsSummaryOpen(!isSummaryOpen)} 
//           isSummaryOpen={isSummaryOpen} 
//           view={view} 
//         />

//         <main className="main-view-container">
//           {/* Chat View */}
//           {view === "chat" && (
//             <ChatWindow 
//               key={activeContract?.id || "new_chat"} 
//               contract={activeContract} 
//               onSendMessage={sendMessage} 
//               onUploadSuccess={handleUploadSuccess} 
//             />
//           )}

//           {/* Negotiation View */}
//           {view === "negotiation" && <NegotiationPage key="neg_page" />}

//           {/* Comparison View */}
//           {view === "comparison" && (
//             <ContractComparison key="comp_page" activeContract={activeContract} />
//           )}

//           {/* NEW: Dealer Simulator View */}
//           {view === "simulator" && (
//             <DealerSimulator 
//               key="sim_page" 
//               activeContract={activeContract} 
//             />
//           )}

//           {/* VIN Check View */}
//           {view === "vin" && (
//             <VinPriceCheck
//               key="fixed_vin_price_check" // Change from activeContract?.id to a fixed string
//               initialVin={activeContract?.summary?.vin || ""}
//               initialPrice={activeContract?.summary?.purchasePrice || ""}
//               onCheck={handleVinCheck}
//             />
//           )}
//         </main>
//       </div>

//       {isSummaryOpen && activeContract?.summary && Object.keys(activeContract.summary).length > 0 && (
//         <SummaryPanel 
//           summary={activeContract.summary} 
//           carName={activeContract.carName} 
//           onClose={() => setIsSummaryOpen(false)} 
//         />
//       )}
//     </div>
//   );
// }

// export default App;




























