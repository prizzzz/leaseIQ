import { useState, useMemo, useEffect, useRef } from "react";
import { api } from "../services/api";
import "./ContractComparison.css";

// Sujith's Logic Imports
import { calculateContractRatings } from "../utils/ratingCalculator";
import { calculateTotalScore } from "../constants/ratingConfig";
import { generateInsights } from "../utils/insightGenerator";
import { formatValue, getFieldLabel, FIELD_ORDER } from "../utils/fieldMapping";

export default function ContractComparison() {
  const [files, setFiles] = useState({ left: null, right: null });
  const [data, setData] = useState({ left: null, right: null });
  const [loading, setLoading] = useState(false);
  
  // Reference for auto-scrolling
  const resultsRef = useRef(null);

  // Trigger smooth scroll when data is populated
  useEffect(() => {
    if (data.left && data.right && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [data]);

  const handleCompare = async () => {
    if (!files.left || !files.right) {
      return alert("Please upload two documents to compare!");
    }

    setLoading(true);
    try {
      const [resLeft, resRight] = await Promise.all([
        api.uploadContract(files.left),
        api.uploadContract(files.right),
      ]);

      // SAFETY CHECK: Ensure we are grabbing the actual contract data 
      // from the backend response.
      const leftData = resLeft.data?.data || resLeft.data || resLeft;
      const rightData = resRight.data?.data || resRight.data || resRight;

      setData({
        left: { ...leftData, name: files.left.name },
        right: { ...rightData, name: files.right.name },
      });
    } catch (err) {
      console.error("Comparison Error:", err);
      // Helpful for debugging: check if the error is a 404 (endpoint path issue)
      alert("Analysis failed. Please check your backend connection or file types.");
    } finally {
      setLoading(false);
    }
  };
  const results = useMemo(() => {
    if (!data.left || !data.right) return null;

    const leftRatings = calculateContractRatings(data.left);
    const rightRatings = calculateContractRatings(data.right);

    return {
      leftScore: calculateTotalScore(leftRatings),
      rightScore: calculateTotalScore(rightRatings),
      insights: generateInsights(data.left, data.right),
    };
  }, [data]);

  return (
    <div className="page-wrapper production-view">
      <div className="header-box">
        <h1>AI Comparison Lab</h1>
        <p>Upload two contracts for a side-by-side financial fairness analysis.</p>
      </div>

      <div className="upload-grid">
        <div className={`upload-card ${files.left ? "has-file" : ""}`}>
          <label htmlFor="file-left">
            <span className="upload-icon">{files.left ? "✅" : "📁"}</span>
            <span className="label-text">
              {files.left ? files.left.name : "Choose Contract A"}
            </span>
          </label>
          <input
            id="file-left"
            type="file"
            accept=".pdf"
            onChange={(e) => setFiles({ ...files, left: e.target.files[0] })}
          />
        </div>

        <div className="vs-circle">VS</div>

        <div className={`upload-card ${files.right ? "has-file" : ""}`}>
          <label htmlFor="file-right">
            <span className="upload-icon">{files.right ? "✅" : "📁"}</span>
            <span className="label-text">
              {files.right ? files.right.name : "Choose Contract B"}
            </span>
          </label>
          <input
            id="file-right"
            type="file"
            accept=".pdf"
            onChange={(e) => setFiles({ ...files, right: e.target.files[0] })}
          />
        </div>
      </div>

      <button
        className={`compare-btn ${loading ? "loading" : ""}`}
        onClick={handleCompare}
        disabled={loading || !files.left || !files.right}
      >
        {loading ? "Analyzing with AI..." : "Start Comparison"}
      </button>

      {/* RESULTS AREA */}
      {results && (
        <div className="results-container animate-fade-in" ref={resultsRef}>
          <div className="score-banner">
            <div className="score-box">
              <h3>{data.left.name}</h3>
              <div className="big-score" style={{ color: getScoreColor(results.leftScore) }}>
                {results.leftScore}/10
              </div>
            </div>
            <div className="score-box">
              <h3>{data.right.name}</h3>
              <div className="big-score" style={{ color: getScoreColor(results.rightScore) }}>
                {results.rightScore}/10
              </div>
            </div>
          </div>
                
          <div className="insights-section">
            <h4><span>✨</span> AI Comparison Insights</h4>
            <ul>
              {results.insights.map((msg, i) => (
                <li key={i}>
                  {msg}
                </li>
              ))}
            </ul>
          </div>

          <div className="table-wrapper">
            <table className="details-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>{data.left.name}</th>
                  <th>{data.right.name}</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_ORDER.map((key) => (
                  <tr key={key} className={data.left[key] !== data.right[key] ? "diff-row" : ""}>
                    <td className="feature-label">{getFieldLabel(key)}</td>
                    <td>{formatValue(data.left[key], key)}</td>
                    <td>{formatValue(data.right[key], key)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getScoreColor(score) {
  if (score >= 7) return "#2ecc71";
  if (score >= 4) return "#f39c12";
  return "#e74c3c";
}



// import { useState, useMemo, useEffect, useRef } from "react";
// import { api } from "../services/api";
// import "./ContractComparison.css";

// // Sujith's Logic Imports
// import { calculateContractRatings } from "../utils/ratingCalculator";
// import { calculateTotalScore } from "../constants/ratingConfig";
// import { generateInsights } from "../utils/insightGenerator";
// import { formatValue, getFieldLabel, FIELD_ORDER } from "../utils/fieldMapping";

// export default function ContractComparison() {
//   const [files, setFiles] = useState({ left: null, right: null });
//   const [data, setData] = useState({ left: null, right: null });
//   const [loading, setLoading] = useState(false);
  
//   // Reference for auto-scrolling
//   const resultsRef = useRef(null);

//   // Trigger smooth scroll when data is populated
//   useEffect(() => {
//     if (data.left && data.right && resultsRef.current) {
//       resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
//     }
//   }, [data]);

//   const handleCompare = async () => {
//     if (!files.left || !files.right) {
//       return alert("Please upload two documents to compare!");
//     }

//     setLoading(true);
//     try {
//       const [resLeft, resRight] = await Promise.all([
//         api.uploadContract(files.left),
//         api.uploadContract(files.right),
//       ]);

//       // SAFETY CHECK: Ensure we are grabbing the actual contract data 
//       // from the backend response.
//       const leftData = resLeft.data?.data || resLeft.data || resLeft;
//       const rightData = resRight.data?.data || resRight.data || resRight;

//       setData({
//         left: { ...leftData, name: files.left.name },
//         right: { ...rightData, name: files.right.name },
//       });
//     } catch (err) {
//       console.error("Comparison Error:", err);
//       // Helpful for debugging: check if the error is a 404 (endpoint path issue)
//       alert("Analysis failed. Please check your backend connection or file types.");
//     } finally {
//       setLoading(false);
//     }
//   };
//   const results = useMemo(() => {
//     if (!data.left || !data.right) return null;

//     const leftRatings = calculateContractRatings(data.left);
//     const rightRatings = calculateContractRatings(data.right);

//     return {
//       leftScore: calculateTotalScore(leftRatings),
//       rightScore: calculateTotalScore(rightRatings),
//       insights: generateInsights(data.left, data.right),
//     };
//   }, [data]);

//   return (
//     <div className="page-wrapper production-view">
//       <div className="header-box">
//         <h1>AI Comparison Lab</h1>
//         <p>Upload two contracts for a side-by-side financial fairness analysis.</p>
//       </div>

//       <div className="upload-grid">
//         <div className={`upload-card ${files.left ? "has-file" : ""}`}>
//           <label htmlFor="file-left">
//             <span className="upload-icon">{files.left ? "✅" : "📁"}</span>
//             <span className="label-text">
//               {files.left ? files.left.name : "Choose Contract A"}
//             </span>
//           </label>
//           <input
//             id="file-left"
//             type="file"
//             accept=".pdf"
//             onChange={(e) => setFiles({ ...files, left: e.target.files[0] })}
//           />
//         </div>

//         <div className="vs-circle">VS</div>

//         <div className={`upload-card ${files.right ? "has-file" : ""}`}>
//           <label htmlFor="file-right">
//             <span className="upload-icon">{files.right ? "✅" : "📁"}</span>
//             <span className="label-text">
//               {files.right ? files.right.name : "Choose Contract B"}
//             </span>
//           </label>
//           <input
//             id="file-right"
//             type="file"
//             accept=".pdf"
//             onChange={(e) => setFiles({ ...files, right: e.target.files[0] })}
//           />
//         </div>
//       </div>

//       <button
//         className={`compare-btn ${loading ? "loading" : ""}`}
//         onClick={handleCompare}
//         disabled={loading || !files.left || !files.right}
//       >
//         {loading ? "Analyzing with AI..." : "Start Comparison"}
//       </button>

//       {/* RESULTS AREA */}
//       {results && (
//         <div className="results-container animate-fade-in" ref={resultsRef}>
//           <div className="score-banner">
//             <div className="score-box">
//               <h3>{data.left.name}</h3>
//               <div className="big-score" style={{ color: getScoreColor(results.leftScore) }}>
//                 {results.leftScore}/10
//               </div>
//             </div>
//             <div className="score-box">
//               <h3>{data.right.name}</h3>
//               <div className="big-score" style={{ color: getScoreColor(results.rightScore) }}>
//                 {results.rightScore}/10
//               </div>
//             </div>
//           </div>
                
//           <div className="insights-section">
//             <h4><span>✨</span> AI Comparison Insights</h4>
//             <ul>
//               {results.insights.map((msg, i) => (
//                 <li key={i}>
//                   {msg}
//                 </li>
//               ))}
//             </ul>
//           </div>

//           <div className="table-wrapper">
//             <table className="details-table">
//               <thead>
//                 <tr>
//                   <th>Feature</th>
//                   <th>{data.left.name}</th>
//                   <th>{data.right.name}</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {FIELD_ORDER.map((key) => (
//                   <tr key={key} className={data.left[key] !== data.right[key] ? "diff-row" : ""}>
//                     <td className="feature-label">{getFieldLabel(key)}</td>
//                     <td>{formatValue(data.left[key], key)}</td>
//                     <td>{formatValue(data.right[key], key)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// function getScoreColor(score) {
//   if (score >= 7) return "#2ecc71";
//   if (score >= 4) return "#f39c12";
//   return "#e74c3c";
// }