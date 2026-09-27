import React from "react";

const Cell = ({ label, value, testId }) => (
  <div>
    <label>{label}</label>
    <div className="val" data-testid={testId}>{value || "—"}</div>
  </div>
);

export const Workflow = ({ data }) => {
  return (
    <div className="workflow" data-testid="workflow-strip">
      <Cell label="Created By" value={data?.createdBy} testId="wf-created-by" />
      <Cell label="Checked By" value={data?.checkedBy} testId="wf-checked-by" />
      <Cell label="Prepared By" value={data?.preparedBy} testId="wf-prepared-by" />
      <Cell label="Approved By" value={data?.approvedBy} testId="wf-approved-by" />
      <Cell label="Approval Date" value={data?.approvalDate} testId="wf-approval-date" />
      <Cell label="Expiry Date" value={data?.expiryDate} testId="wf-expiry-date" />
    </div>
  );
};

export default Workflow;
