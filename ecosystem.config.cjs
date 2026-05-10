module.exports = {
  apps: [
    {
      name: 'swirlock-idp-base',
      script: 'dist/src/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
