const API_KEY = 'YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI';
const platform = new H.service.Platform({ apikey: API_KEY });
const defaultLayers = platform.createDefaultLayers();
let map, routingService, userMarker, routeLine;
let destination = null;
let intervalId = null;

function initMap(center) {
  map = new H.Map(document.getElementById('map'), defaultLayers.vector.normal.map, {
    center,
    zoom: 14
  });
  const mapEvents = new H.mapevents.MapEvents(map);
  new H.mapevents.Behavior(mapEvents);
  H.ui.UI.createDefault(map, defaultLayers);
  routingService = platform.getRoutingService(null, 8);
}

function updateRoute(from, to) {
  const routingParams = {
    mode: 'fastest;car',
    representation: 'display',
    waypoint0: `geo!${from.lat},${from.lng}`,
    waypoint1: `geo!${to.lat},${to.lng}`
  };

  routingService.calculateRoute(routingParams, (result) => {
    if (routeLine) map.removeObject(routeLine);
    if (!result.response.route) return;
    const route = result.response.route[0];
    const lineString = new H.geo.LineString();

    route.shape.forEach(point => {
      const [lat, lng] = point.split(',');
      lineString.pushLatLngAlt(+lat, +lng, 0);
    });

    routeLine = new H.map.Polyline(lineString, {
      style: { strokeColor: 'blue', lineWidth: 5 }
    });

    map.addObject(routeLine);
    map.getViewModel().setLookAtData({ bounds: routeLine.getBoundingBox() });
  }, alert);
}

function sendLiveLocation(location) {
  fetch('/live-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(location)
  }).catch(err => console.error('Failed to send live location:', err));
}

function trackUser() {
  if (!navigator.geolocation) return alert("Geolocation not supported");

  navigator.geolocation.watchPosition((pos) => {
    const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };

    if (!map) initMap(userLoc);
    if (userMarker) map.removeObject(userMarker);
    userMarker = new H.map.Marker(userLoc);
    map.addObject(userMarker);

    if (destination) updateRoute(userLoc, destination);

    sendLiveLocation({
      latitude: userLoc.lat,
      longitude: userLoc.lng,
      timestamp: new Date().toISOString()
    });

  }, err => console.error('Location error:', err), {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000
  });

  if (!intervalId) {
    intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        sendLiveLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: new Date().toISOString()
        });
      });
    }, 3000);
  }
}

function handleScan(data) {
  try {
    const parsed = JSON.parse(data);
    destination = { lat: parsed.latitude, lng: parsed.longitude };
    trackUser();
  } catch (e) {
    alert('Invalid QR data');
  }
}

new Html5Qrcode("reader").start(
  { facingMode: "environment" },
  { fps: 10, qrbox: 250 },
  handleScan,
  err => console.warn("QR scan error", err)
);
