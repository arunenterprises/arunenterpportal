// Offline GSTIN decoder: validates checksum and derives State + PAN (no API key needed).
const STATES = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
  "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};
const ENTITY = { P: "Individual / Proprietor", C: "Company", H: "HUF", F: "Firm / LLP", A: "AOP", T: "Trust", B: "BOI", L: "Local Authority", J: "Artificial Juridical Person", G: "Government" };
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const checksum = (g14) => {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(g14[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
};

export const parseGstin = (raw) => {
  const g = String(raw || "").toUpperCase().trim();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { valid: false };
  const state = STATES[g.slice(0, 2)];
  return {
    valid: !!state && checksum(g.slice(0, 14)) === g[14],
    stateCode: g.slice(0, 2), state: state || "", pan: g.slice(2, 12),
    entityType: ENTITY[g[5]] || "", tdsHint: ["P", "H"].includes(g[5]) ? 1 : 2,
  };
};
