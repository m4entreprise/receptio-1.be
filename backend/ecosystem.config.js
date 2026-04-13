module.exports = {
  apps: [{
    name: 'apireceptiobe',
    script: 'dist/index.js',
    instances: 'max',   // utilise tous les cœurs CPU disponibles
    exec_mode: 'cluster',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
