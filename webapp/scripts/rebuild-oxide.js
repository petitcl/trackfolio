try {
    require('@tailwindcss/oxide');
    console.log('Oxide loaded successfully');
  } catch (e) {
    console.error('Oxide rebuild failed:', e);
    process.exit(1);
  }
