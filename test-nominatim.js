async function test() {
  const res = await fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=31.7683&lon=35.2137&zoom=18&addressdetails=1", { headers: { "User-Agent": "MyTestApp/1.0" }});
  const data = await res.json();
  console.log(JSON.stringify(data.address, null, 2));
  console.log("display_name:", data.display_name);
}
test();
