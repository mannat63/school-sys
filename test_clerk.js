async function test() {
  const res = await fetch('https://api.clerk.com/v1/users', {
    headers: {
      'Authorization': 'Bearer sk_test_l53REKwijMorKgGTofA3bhHgTZnWuObAGU8aZcsNqT'
    }
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', data);
}
test();
