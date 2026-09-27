import React from "react";
import { STEP_LABEL } from "../lib/store";

export const StepTabs = ({ step = 1, labels }) => {
  const items = labels || [STEP_LABEL[1], STEP_LABEL[2], STEP_LABEL[3]];
  return (
    <div className="step-tabs" data-testid="step-tabs" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((label, i) => {
        const n = i + 1;
        return (
          <div
            key={n}
            className={`tab ${step === n ? "active" : step > n ? "done" : ""}`}
            data-testid={`step-tab-${n}`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

export default StepTabs;
