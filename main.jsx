import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PunchList from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PunchList />
  </StrictMode>
);
