import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

for (const key of ['kmsit_db_v1', 'kmsit_meta_v1', 'kmsit_session_token', 'kmsit_pref_theme', 'kmsit_pref_lang']) {
	localStorage.removeItem(key);
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
