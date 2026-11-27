module.exports = {
  apps: [
    {
      name: 'frosh-server',
      script: './dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '0.0.0.0',
      },
    },
  ],
};
