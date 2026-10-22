// Mounts the prototype and loads its screen and Tools styles.
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/app.css";
import "./tools/tools.css";
createRoot(document.getElementById("root")!).render(<App />);
