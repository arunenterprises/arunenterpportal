import { useEffect } from "react";

// Keeps every module's action-button strip pinned to the bottom (toggle UI removed on request)
export const ActionStripToggle = () => {
  useEffect(() => { document.body.dataset.strip = "bottom"; localStorage.setItem("strip_pos_v1", "bottom"); }, []);
  return null;
};

export default ActionStripToggle;
