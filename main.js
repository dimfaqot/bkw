
const api="https://api.walisongosragen.com/";

const menu=(menu)=>{
    fetch('data.json')
  .then(response => response.json())
  .then(res => {
   
   let html='';
    res.menu.forEach(e => {
        if(e.menu==menu){
            $(".judul").html(`<i class="${e.icon}"></i> ${e.menu}`);
        }
      html+=`<a href="${e.url+".html"}" class="${(e.menu==menu?"main_menu_active":"main_menu")}"><i class="${e.icon}"></i> ${e.menu}</a>`;
    });
    $(".canvas_menu").html(html);
  })
  .catch(error => console.error('Gagal ambil data:', error));
}

const menu_profile=(menu)=>{
    fetch('data.json')
  .then(response => response.json())
  .then(res => {
   
   let html='';
    res.profile.forEach(e => {  
     html+=` <a class="btn_get_data_profile" data-db="${e.url}" href="${api+"general/profile/"+e.url}">
            <div><i class="${e.icon} ${(menu==e.url?"text-pink":"")}"></i></div>
            <label><span class="${(menu==e.url?"text-pink":"")}">${e.menu}</span></label>
        </a>`;
    });
    $(".sub_menu").html(html);
  })
  .catch(error => console.error('Gagal ambil data:', error));
}

 async function get_datas() {
                try {
                    const response = await fetch('data.json');
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    return data;
                } catch (err) {
                    console.error('Error fetching data:', err);
                    return null;
                }
            }

 async function fetchData(url) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    return data;
                } catch (err) {
                    console.error('Error fetching data:', err);
                    return null;
                }
            }

function int_to_tgl(timestamp, format = "d-m-Y") {
  const bulanIndo = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const date = new Date(timestamp * 1000); // ubah dari detik ke milidetik

  const hari = String(date.getDate()).padStart(2, '0');
  const bulanIndex = date.getMonth();
  const bulanAngka = String(bulanIndex + 1).padStart(2, '0');
  const bulanNama = bulanIndo[bulanIndex];
  const tahun = date.getFullYear();

  if (format === "d-m-Y") {
    return `${hari}-${bulanAngka}-${tahun}`;
  } else if (format === "d-M-Y") {
    return `${hari}-${bulanNama}-${tahun}`;
  }else if (format === "d M Y") {
    return `${hari} ${bulanNama} ${tahun}`;
  } else {
    return "Format tidak dikenali";
  }
}

function angka(angka) {
  return Number(angka).toLocaleString('id-ID');
}

function tgl_now(order="d") {
  const now = new Date();

  const tanggal = String(now.getDate()).padStart(2, '0');
  const bulan = String(now.getMonth() + 1).padStart(2, '0'); // bulan dimulai dari 0
  const tahun = String(now.getFullYear());

  if(order=="d"){
    return tanggal;
  }else if(order=="m"){
    return bulan;
  }else if(order=="y"){
    return tahun;
  }
}

