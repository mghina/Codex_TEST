import React from "react";
import ReactDOM from "react-dom/client";
import TicketingCanvasDemo from "./components/TicketingCanvasDemo";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TicketingCanvasDemo />
  </React.StrictMode>
);
