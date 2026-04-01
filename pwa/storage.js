// pwa/storage.js

// Check for IndexedDB support
if (!window.indexedDB) {
    console.log("This browser doesn't support IndexedDB");
}

// Open (or create) the database
const request = indexedDB.open('CardCache', 1);

request.onerror = function(event) {
    console.error('Database error: ' + event.target.errorCode);
};

request.onsuccess = function(event) {
    console.log('Database opened successfully');
    const db = event.target.result;
    // Start using the database here
};

request.onupgradeneeded = function(event) {
    const db = event.target.result;
    // Create an object store for cards data
    const objectStore = db.createObjectStore('cards', { keyPath: 'id' });
    // Create indexes for various fields
    objectStore.createIndex('productStatus', 'status', { unique: false });
};

// Function to add or update card data
function addOrUpdateCard(cardData) {
    const dbRequest = indexedDB.open('CardCache', 1);
    dbRequest.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['cards'], 'readwrite');
        const objectStore = transaction.objectStore('cards');
        const request = objectStore.put(cardData);

        request.onsuccess = function() {
            console.log('Card saved successfully');
        };
    };
}

// Function to fetch cards data
function fetchCards(callback) {
    const dbRequest = indexedDB.open('CardCache', 1);
    dbRequest.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['cards'], 'readonly');
        const objectStore = transaction.objectStore('cards');
        const request = objectStore.getAll();

        request.onsuccess = function() {
            callback(request.result);
        };
    };
}

// Function to handle free products and unlocked codes
function handleFreeProducts(cardId, unlockCode) {
    fetchCards((cards) => {
        const card = cards.find(c => c.id === cardId);
        if (card) {
            card.status = 'unlocked'; // Update status to unlocked
            card.unlockCode = unlockCode;
            addOrUpdateCard(card); // Save updated card
        } else {
            console.log('Card not found');
        }
    });
}

// Function to serve offline content
function serveOfflineContent() {
    fetchCards((cards) => {
        if (cards.length > 0) {
            console.log('Offline card data:', cards);
            // Display cards data to user
        } else {
            console.log('No card data available offline');
        }
    });
}

// Example usage
// addOrUpdateCard({id: 1, name: 'Card A', status: 'free'});
// handleFreeProducts(1, 'UNLOCK123');
// serveOfflineContent();