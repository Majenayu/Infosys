// HERE Map initialization
const platform = new H.service.Platform({
  apikey: "mzDLjmDOdq62sKIc4y81FgMv8pqj2ndZWPBraNyCm2w"
});

const defaultLayers = platform.createDefaultLayers();
const map = new H.Map(
  document.getElementById('mapContainer'),
  defaultLayers.vector.normal.map,
  {
    zoom: 5,
    center: { lat: 20.5937, lng: 78.9629 } // Center on India
  }
);

window.addEventListener('resize', () => map.getViewPort().resize());

const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
const ui = H.ui.UI.createDefault(map, defaultLayers);

// Handle form submission
document.getElementById('companyForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = {
    name: this.name.value,
    contactPerson: this.contactPerson.value,
    email: this.email.value,
    phone: this.phone.value,
    apiUrl: this.apiUrl.value,
    apiKey: this.apiKey.value,
    address: this.address.value
  };

  try {
    const response = await fetch('/register-company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    alert(data.message || 'Registration complete!');
    this.reset();
  } catch (error) {
    alert('Error submitting form.');
    console.error(error);
  }
});
