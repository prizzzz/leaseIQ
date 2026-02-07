


// import axios from 'axios';

// // Ensure your backend is running at this address with the /api prefix
// const API_BASE_URL = 'http://127.0.0.1:8000/api'; 

// const apiClient = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// export const api = {
//   // --- 1. Upload Logic (Used by Chat, Comparison, and Negotiation) ---
//   uploadContract: async (file) => {
//       const formData = new FormData();
//       formData.append('file', file);
//       const res = await apiClient.post('/upload', formData, {
//         headers: { 'Content-Type': 'multipart/form-data' },
//       });
//       return res.data; // Return .data here so everyone gets the same thing
//   },

//   // Alias for your original ChatWindow logic to prevent "uploadLease is not a function"
//   uploadLease: async (file) => {
//     return await api.uploadContract(file);
//   },

//   // --- 2. Negotiation Multi-Step Logic (Harshitha's Part) ---
//   runOCR: async (fileId) => {
//     const res = await apiClient.post(`/ocr/${fileId}`);
//     return res.data;
//   },

//   analyzeContract: async (fileId) => {
//     const res = await apiClient.post(`/contracts/${fileId}/analyze`);
//     return res.data;
//   },

//   getAnalysis: async (fileId) => {
//     const res = await apiClient.get(`/contracts/${fileId}/analysis`);
//     return res.data;
//   },

//   sendChat: async (fileId, message, history, intent = "chat") => {
//     const res = await apiClient.post(`/contracts/${fileId}/chat`, {
//       file_id: fileId,
//       message,
//       history,
//       intent,
//     });
//     return res.data;
//   },

//   // --- 3. Market/VIN Check Logic ---
//   getMarketAnalysis: async (vin, price) => {
//     const cleanVin = (!vin || vin === "N/A" || vin === "undefined" || vin === "unknown") ? "unknown" : vin;
//     return await apiClient.get(`/market-info/${cleanVin}`, {
//       params: { contract_price: price },
//     });
//   },

//   // --- 4. Chat Assistant Logic (Streaming Native Fetch) ---
//   sendChatMessage: async (userQuery, filename) => {
//     // Standardizing filename format
//     let fileNameString = (typeof filename === 'object' && filename !== null) 
//       ? filename.serverFilename 
//       : filename;

//     const validFilename = (!fileNameString || fileNameString === "null" || fileNameString === "undefined") 
//       ? null 
//       : fileNameString;

//     return await fetch(`${API_BASE_URL}/chat`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ 
//         message: userQuery, 
//         filename: validFilename 
//       }),
//     });
//   },

//   // --- 5. Comparison Page Logic ---
//   compareTwoContracts: async (file1, file2) => {
//     try {
//       const [res1, res2] = await Promise.all([
//         api.uploadContract(file1),
//         api.uploadContract(file2)
//       ]);
//       return {
//         contract1: res1.data, 
//         contract2: res2.data
//       };
//     } catch (error) {
//       console.error("❌ Comparison API Error:", error);
//       throw error;
//     }
//   }
// };

// /** * INDIVIDUAL EXPORTS
//  * These ensure individual components like NegotiationPage or ChatWindow
//  * don't break if they use { uploadLease } instead of api.uploadLease
//  */
// export const uploadLease = api.uploadLease;
// export const uploadContract = async (file) => {
//   const res = await api.uploadContract(file);
//   return res.data; 
// };
// export const runOCR = api.runOCR;
// export const analyzeContract = api.analyzeContract;
// export const getAnalysis = api.getAnalysis;
// export const sendChat = api.sendChat;











import axios from 'axios';

// Ensure your backend is running at this address with the /api prefix
const API_BASE_URL = 'http://127.0.0.1:8000/api'; 

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // --- 1. Upload Logic (Used by Chat, Comparison, and Negotiation) ---
  uploadContract: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    // Returns the full Axios response so .data can be accessed by Comparison
    return await apiClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Alias for your original ChatWindow logic to prevent "uploadLease is not a function"
  uploadLease: async (file) => {
    return await api.uploadContract(file);
  },

  // --- 2. Negotiation Multi-Step Logic (Harshitha's Part) ---
  runOCR: async (fileId) => {
    const res = await apiClient.post(`/ocr/${fileId}`);
    return res.data;
  },

  analyzeContract: async (fileId) => {
    const res = await apiClient.post(`/contracts/${fileId}/analyze`);
    return res.data;
  },

  getAnalysis: async (fileId) => {
    const res = await apiClient.get(`/contracts/${fileId}/analysis`);
    return res.data;
  },

  sendChat: async (fileId, message, history, intent = "chat") => {
    const res = await apiClient.post(`/contracts/${fileId}/chat`, {
      file_id: fileId,
      message,
      history,
      intent,
    });
    return res.data;
  },

  // --- 3. Market/VIN Check Logic ---
  getMarketAnalysis: async (vin, price) => {
    const cleanVin = (!vin || vin === "N/A" || vin === "undefined" || vin === "unknown") ? "unknown" : vin;
    return await apiClient.get(`/market-info/${cleanVin}`, {
      params: { contract_price: price },
    });
  },

  // --- 4. Chat Assistant Logic (Streaming Native Fetch) ---
  sendChatMessage: async (userQuery, filename) => {
    // Standardizing filename format
    let fileNameString = (typeof filename === 'object' && filename !== null) 
      ? filename.serverFilename 
      : filename;

    const validFilename = (!fileNameString || fileNameString === "null" || fileNameString === "undefined") 
      ? null 
      : fileNameString;

    return await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: userQuery, 
        filename: validFilename 
      }),
    });
  },

  // --- 5. Comparison Page Logic ---
  compareTwoContracts: async (file1, file2) => {
    try {
      const [res1, res2] = await Promise.all([
        api.uploadContract(file1),
        api.uploadContract(file2)
      ]);
      return {
        contract1: res1.data, 
        contract2: res2.data
      };
    } catch (error) {
      console.error("❌ Comparison API Error:", error);
      throw error;
    }
  }
};

/** * INDIVIDUAL EXPORTS
 * These ensure individual components like NegotiationPage or ChatWindow
 * don't break if they use { uploadLease } instead of api.uploadLease
 */
export const uploadLease = api.uploadLease;
export const uploadContract = async (file) => {
  const res = await api.uploadContract(file);
  return res.data; 
};
export const runOCR = api.runOCR;
export const analyzeContract = api.analyzeContract;
export const getAnalysis = api.getAnalysis;
export const sendChat = api.sendChat;






