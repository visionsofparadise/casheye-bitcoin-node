const fs = require('fs')

const env = `
STAGE=${process.env.STAGE}
SECRET=${process.env.SECRET}`

fs.writeFileSync('.env', env)