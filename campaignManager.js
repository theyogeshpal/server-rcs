const xlsx = require('xlsx');

function startCampaign(excelFilePath, textMessage, imageUrl, connectedSockets) {
  if (connectedSockets.length === 0) {
    throw new Error('No devices connected. Cannot start campaign.');
  }

  // 1. Parse Excel
  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert sheet to json array. Assumes first row might be headers
  // Try to find a column with numbers. If simple list, just grab the first column.
  const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  const contacts = [];
  
  // Extract contacts (assuming phone numbers are the first cell of each row, or search for it)
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row.length > 0) {
      let phone = String(row[0]).trim();
      // Basic validation for phone number (can be improved)
      if (phone && phone.length >= 7 && phone !== 'Phone' && phone !== 'Number' && phone !== 'Contact') {
         contacts.push(phone);
      }
    }
  }

  if (contacts.length === 0) {
    throw new Error('No valid contacts found in the Excel sheet.');
  }

  // 2. Distribute Contacts
  const totalSockets = connectedSockets.length;
  const contactsPerDevice = Math.floor(contacts.length / totalSockets);
  const remainder = contacts.length % totalSockets;

  let startIndex = 0;
  
  const distributionResult = [];

  for (let i = 0; i < totalSockets; i++) {
    // Add one extra contact to early devices if there's a remainder
    const itemsForThisDevice = contactsPerDevice + (i < remainder ? 1 : 0);
    const endIndex = startIndex + itemsForThisDevice;
    
    const chunk = contacts.slice(startIndex, endIndex);
    const socket = connectedSockets[i];

    if (chunk.length > 0) {
      // 3. Emit event to the socket
      socket.emit('START_CAMPAIGN', {
        textMessage: textMessage,
        imageUrl: imageUrl, // this is a relative URL like /uploads/123.jpg
        contacts: chunk
      });

      distributionResult.push({
        deviceId: socket.id,
        contactsAssigned: chunk.length
      });
    }

    startIndex = endIndex;
  }

  return {
    totalContacts: contacts.length,
    devicesUsed: totalSockets,
    distribution: distributionResult
  };
}

module.exports = {
  startCampaign
};
