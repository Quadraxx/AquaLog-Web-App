// Init
AOS.init({ duration: 800, once: true });

// --- DEĞİŞKENLER ---
let currentUser = null;
let userCatches = [];
let map, myChart;
let selectedLat = null, selectedLng = null, tempMarker = null, allMarkers = [];

// --- SAYFA YÜKLENİNCE ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    // Tarihi Yazdır
    const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('tr-TR', dateOpts);
});

// --- AUTH İŞLEMLERİ ---
function toggleAuth(type) {
    if(type === 'register') {
        document.getElementById('loginCard').style.display = 'none';
        document.getElementById('registerCard').style.display = 'block';
    } else {
        document.getElementById('registerCard').style.display = 'none';
        document.getElementById('loginCard').style.display = 'block';
    }
}

// Kayıt
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('regUser').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    const avatar = document.querySelector('input[name="avatar"]:checked').value;

    let db = JSON.parse(localStorage.getItem('aquaUsers')) || [];
    if(db.find(u => u.username === user)) {
        Swal.fire({toast:true, position:'top-end', icon:'error', title:'Kullanıcı adı dolu', background:'#1e293b', color:'white'});
        return;
    }

    db.push({ username: user, password: pass, avatar: avatar });
    localStorage.setItem('aquaUsers', JSON.stringify(db));
    
    Swal.fire({icon:'success', title:'Kayıt Başarılı', background:'#1e293b', color:'white'});
    toggleAuth('login');
});

// Giriş
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();

    let db = JSON.parse(localStorage.getItem('aquaUsers')) || [];
    let valid = db.find(u => u.username === user && u.password === pass);

    if(valid) loginSuccess(valid);
    else Swal.fire({toast:true, position:'top-end', icon:'error', title:'Hatalı Giriş', background:'#1e293b', color:'white'});
});

function loginSuccess(userObj) {
    currentUser = userObj.username;
    localStorage.setItem('activeUser', JSON.stringify(userObj));
    
    document.getElementById('authSection').style.setProperty('display', 'none', 'important');
    document.getElementById('dashboardSection').style.setProperty('display', 'flex', 'important');
    
    document.getElementById('sidebarName').innerText = userObj.username;
    
    let icon = 'fa-user';
    if(userObj.avatar === 'captain') icon = 'fa-user-tie';
    if(userObj.avatar === 'diver') icon = 'fa-mask-ventilator';
    if(userObj.avatar === 'fisher') icon = 'fa-user-graduate';
    document.getElementById('sidebarAvatar').innerHTML = `<i class="fa-solid ${icon}"></i>`;

    initSystem();
}

function checkSession() {
    let active = JSON.parse(localStorage.getItem('activeUser'));
    if(active) loginSuccess(active);
}

function logout() {
    localStorage.removeItem('activeUser');
    location.reload();
}

// --- DASHBOARD ---
function initSystem() {
    if(map) map.remove();
    map = L.map('map', {zoomControl:false}).setView([37.7765, 29.0864], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {attribution:'&copy; OSM'}).addTo(map);
    map.on('click', e => placeMarker(e.latlng.lat, e.latlng.lng));

    loadUserData();
    document.getElementById('catchDate').valueAsDate = new Date();
}

function loadUserData() {
    userCatches = JSON.parse(localStorage.getItem(`aquaData_${currentUser}`)) || [];
    updateUI(); updateChart(); loadMapMarkers();
}

function saveData() { localStorage.setItem(`aquaData_${currentUser}`, JSON.stringify(userCatches)); }

document.getElementById('fishForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = document.getElementById('catchDate').value;
    const t = document.getElementById('fishType').value;
    const w = document.getElementById('fishWeight').value;
    const l = document.getElementById('location').value;
    const lat = selectedLat || 37.7765;
    const lng = selectedLng || 29.0864;

    userCatches.push({id:Date.now(), date:d, type:t, weight:parseInt(w), location:l, lat, lng});
    saveData(); updateUI(); updateChart(); loadMapMarkers();
    
    document.getElementById('fishForm').reset();
    document.getElementById('catchDate').valueAsDate = new Date();
    if(tempMarker) map.removeLayer(tempMarker);
    
    Swal.fire({toast:true, position:'top-end', icon:'success', title:'Eklendi', showConfirmButton:false, timer:1500, background:'#1e293b', color:'white'});
});

function placeMarker(lat, lng) {
    selectedLat=lat; selectedLng=lng;
    if(tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([lat, lng]).addTo(map).bindPopup('Seçildi').openPopup();
    document.getElementById('location').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function locateUser() {
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            map.flyTo([pos.coords.latitude, pos.coords.longitude], 14);
            placeMarker(pos.coords.latitude, pos.coords.longitude);
        });
    }
}

function updateUI() {
    const list = document.getElementById('fishList');
    list.innerHTML = '';
    if(userCatches.length===0) document.getElementById('emptyState').style.display='block';
    else {
        document.getElementById('emptyState').style.display='none';
        userCatches.slice().reverse().forEach(f => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `
                <div onclick="map.flyTo([${f.lat}, ${f.lng}], 15)" style="cursor:pointer">
                    <h6>${f.type} <span style="color:#06b6d4">(${f.weight}g)</span></h6>
                    <small>${f.date} | ${f.location}</small>
                </div>
                <button class="text-danger btn-icon-only" onclick="deleteCatch(${f.id})"><i class="fa-solid fa-trash"></i></button>
            `;
            list.appendChild(li);
        });
    }
    document.getElementById('totalCount').innerText = userCatches.length;
    document.getElementById('totalWeight').innerText = (userCatches.reduce((a,b)=>a+b.weight,0)/1000).toFixed(1);
}

function loadMapMarkers() {
    allMarkers.forEach(m => map.removeLayer(m));
    allMarkers = [];
    userCatches.forEach(f => {
        if(f.lat) allMarkers.push(L.marker([f.lat, f.lng]).addTo(map).bindPopup(`<b>${f.type}</b><br>${f.weight}g`));
    });
}

function updateChart() {
    const ctx = document.getElementById('fishChart').getContext('2d');
    const counts = {};
    userCatches.forEach(f => counts[f.type] = (counts[f.type]||0)+1);
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{data:Object.values(counts), backgroundColor: ['#06b6d4','#3b82f6','#8b5cf6','#10b981','#f59e0b'], borderWidth:0}]
        },
        options: {plugins:{legend:{position:'right', labels:{color:'#94a3b8'}}}, cutout:'70%'}
    });
}

function deleteCatch(id) {
    userCatches = userCatches.filter(f => f.id !== id);
    saveData(); updateUI(); updateChart(); loadMapMarkers();
}
function clearAllData() {
    if(confirm('Silinsin mi?')) { userCatches=[]; saveData(); updateUI(); updateChart(); loadMapMarkers(); }
}
function exportToCSV() {
    if(userCatches.length===0) return;
    let csv = "data:text/csv;charset=utf-8,\uFEFFTARIH,TUR,AGIRLIK,KONUM\n";
    userCatches.forEach(r => csv += `${r.date},${r.type},${r.weight},${r.location}\n`);
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "data.csv"; link.click();
}