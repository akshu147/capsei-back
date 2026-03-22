export const extractAadhaar = (text) => {
  const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
  const match = text.match(aadhaarRegex);

  return {
    aadhaarNumber: match ? match[0].replace(/\s/g, "") : null
  };
};

export const extractDL = (text) => {
  const dlRegex = /[A-Z]{2}\d{2}\s?\d{11}/; // basic DL pattern
  const match = text.match(dlRegex);

  return {
    dlNumber: match ? match[0] : null
  };
};