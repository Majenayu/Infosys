// HERE Maps API Configuration
const API_KEY = 'YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI';
const platform = new H.service.Platform({ apikey: API_KEY });
const defaultLayers = platform.createDefaultLayers();

// Initialize map centered on Karnataka
const mapContainer = document.getElementById('mapContainer');
const map = new H.Map(mapContainer, defaultLayers.vector.normal.map, {
    zoom: 7,
    center: { lat: 15.3173, lng: 75.7139 }
});

// Fix: Enable map events and behaviors
const mapEvents = new H.mapevents.MapEvents(map);
const behavior = new H.mapevents.Behavior(mapEvents);
const ui = H.ui.UI.createDefault(map);

// Global variables
let currentMarker = null;
let currentQR = null;
let currentLocation = null;
let searchTimeout = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');
const myLocationBtn = document.getElementById('myLocationBtn');
const geocoder = platform.getSearchService();

// Autocomplete input
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (searchTimeout) clearTimeout(searchTimeout);

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    searchTimeout = setTimeout(() => {
        getSuggestions(query);
    }, 300);
});

// Suggestion fetch
function getSuggestions(query) {
    const params = {
        q: query,
        at: '15.3173,75.7139',
        countryCode: 'IND',
        limit: 5
    };

    geocoder.autosuggest(params, (res) => {
        if (res && res.items) {
            displaySuggestions(res.items);
        } else {
            hideSuggestions();
        }
    }, (err) => {
        console.error('Suggestion error:', err);
        hideSuggestions();
    });
}

function displaySuggestions(items) {
    searchSuggestions.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = item.title + (item.vicinity ? ` - ${item.vicinity}` : '');
        div.onclick = () => selectSuggestion(item);
        searchSuggestions.appendChild(div);
    });
    searchSuggestions.style.display = 'block';
}

function selectSuggestion(item) {
    searchInput.value = item.title;
    hideSuggestions();

    if (item.position) {
        const coords = item.position;
        map.setCenter(coords);
        map.setZoom(15);
        const name = item.title;
        const address = item.vicinity || item.title;
        updateMarker(coords, name, address);
        updateLocationInfo(name, address, coords);
        generateQR(name, address, coords);
    }
}

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            searchLocation(query);
            hideSuggestions();
        }
    }
});

function searchLocation(query) {
    const params = {
        q: `${query} Karnataka`,
        at: '15.3173,75.7139',
        countryCode: 'IND',
        limit: 1
    };

    geocoder.geocode(params, (res) => {
        if (res.items && res.items.length > 0) {
            const loc = res.items[0];
            const coords = loc.position;
            const address = loc.address?.label || loc.vicinity || loc.title;
            updateMarker(coords, loc.title, address);
            updateLocationInfo(loc.title, address, coords);
            generateQR(loc.title, address, coords);
        } else {
            showStatus('Location not found in Karnataka', 'error');
        }
    }, (err) => {
        console.error('Search error:', err);
        showStatus('Search failed', 'error');
    });
}

function hideSuggestions() {
    searchSuggestions.style.display = 'none';
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) hideSuggestions();
});

// Geolocation
myLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showStatus('Geolocation not supported', 'error');
        return;
    }

    myLocationBtn.textContent = '📍 Getting Location...';
    myLocationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setCenter(coords);
        map.setZoom(16);

        geocoder.reverseGeocode({ at: `${coords.lat},${coords.lng}` }, (res) => {
            const loc = res.items?.[0];
            const name = 'My Current Location';
            const address = loc?.address?.label || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
            updateMarker(coords, name, address);
            updateLocationInfo(name, address, coords);
            generateQR(name, address, coords);
            myLocationBtn.textContent = '📍 Get My Location';
            myLocationBtn.disabled = false;
            showStatus('Location found!', 'success');
        }, (err) => {
            console.error('Reverse error:', err);
            const name = 'My Current Location';
            const address = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
            updateMarker(coords, name, address);
            updateLocationInfo(name, address, coords);
            generateQR(name, address, coords);
            myLocationBtn.textContent = '📍 Get My Location';
            myLocationBtn.disabled = false;
            showStatus('Location found!', 'success');
        });

    }, (err) => {
        let msg = 'Unable to get location';
        if (err.code === err.PERMISSION_DENIED) msg = 'Permission denied';
        else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Position unavailable';
        else if (err.code === err.TIMEOUT) msg = 'Request timed out';
        showStatus(msg, 'error');
        myLocationBtn.textContent = '📍 Get My Location';
        myLocationBtn.disabled = false;
    });
});

// Map click
map.addEventListener('tap', (evt) => {
    const pointer = evt.currentPointer;
    const coord = map.screenToGeo(pointer.viewportX, pointer.viewportY);

    geocoder.reverseGeocode({ at: `${coord.lat},${coord.lng}` }, (res) => {
        const loc = res.items?.[0];
        const name = loc?.title || 'Selected Location';
        const address = loc?.address?.label || `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`;
        updateMarker(coord, name, address);
        updateLocationInfo(name, address, coord);
        generateQR(name, address, coord);
        showStatus('Location selected from map', 'success');
    });
});

// Marker update
function updateMarker(coords, name, address) {
    if (currentMarker) map.removeObject(currentMarker);
    const iconMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="red" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>';
    const icon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconMarkup));
    currentMarker = new H.map.Marker(coords, { icon });
    map.addObject(currentMarker);

    const bubble = new H.ui.InfoBubble({ lat: coords.lat, lng: coords.lng }, { content: address });
    ui.addBubble(bubble);
    setTimeout(() => ui.removeBubble(bubble), 3000);
}

function updateLocationInfo(name, address, coords) {
    document.getElementById('locationName').textContent = name;
    document.getElementById('locationAddress').textContent = address;
    document.getElementById('locationCoords').textContent = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    currentLocation = { name, address, coords };
}

function generateQR(name, address, coords) {
    const qrContainer = document.getElementById('qrcode');
    const downloadBtn = document.getElementById('downloadBtn');
    qrContainer.innerHTML = '';

    const data = {
        name,
        address,
        latitude: coords.lat,
        longitude: coords.lng,
        googleMapsUrl: `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
        hereMapsUrl: `https://wego.here.com/directions/mix/${coords.lat},${coords.lng}`,
        timestamp: new Date().toISOString()
    };

    try {
        currentQR = new QRCode(qrContainer, {
            text: JSON.stringify(data),
            width: 200,
            height: 200,
            colorDark: '#000',
            colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.H
        });
        downloadBtn.disabled = false;
        storeLocationData(data);
        showStatus('QR code generated!', 'success');
    } catch (err) {
        console.error('QR error:', err);
        showStatus('Failed to generate QR', 'error');
    }
}

async function storeLocationData(data) {
    try {
        await fetch('/store-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch {
        console.warn('Offline or server unavailable');
    }
}

// Download QR
document.getElementById('downloadBtn').addEventListener('click', () => {
    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `QR_${currentLocation.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        showStatus('QR code downloaded!', 'success');
    } else {
        showStatus('No QR canvas found', 'error');
    }
});

function showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = `status ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}

// On load
window.addEventListener('load', () => {
    map.getViewPort().resize();
    showStatus('QR Generator ready. Click map or search to begin.', 'success');
});
