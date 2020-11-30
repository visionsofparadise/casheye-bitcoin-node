const fs = require('fs')

const env = `
STAGE=${process.env.STAGE}
SECRET=${process.env.SECRET}
QUEUE_URL=${process.env.QUEUE_URL}`

fs.writeFileSync('.env', env)