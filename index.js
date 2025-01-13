const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function pollPrices() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-gpu', 
      '--window-size=1280x800'
    ]
  });
  

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  //Woolworths
  await page.goto('https://www.woolworths.com.au/shop/productdetails/453306/woolworths-sandwich-cheese-slices');
  await page.waitForSelector('.price-frame');
  const woolworths = await page.evaluate(() => {
    const title = document.querySelector('h1').innerText;
    const price = document.querySelector('.price-frame').innerText.replace(/[\n$]/g, '');
    const pricePerKg = Math.round(Number(price) * 0.62*100)/100;
    return { title,price,pricePerKg };
  });
  console.log('Woolworths Cheese:', woolworths.title);
  console.log('Price:', woolworths.price);
  console.log('Price per kg ($US)',woolworths.pricePerKg);

  //Walmart
  await page.goto('https://www.walmart.com/ip/Great-Value-Finely-Shredded-Fiesta-Blend-Cheese-32-oz-Bag/10452468');
  await page.waitForSelector('[itemprop="price"]');
  const walmart = await page.evaluate(() => {
    const title = document.querySelector('h1').innerText;
    const price = document.querySelector('[itemprop="price"]').innerText.replace(/[\n$]/g, '');
    const pricePerKg = Math.round((Number(price)/32)*35.274*100)/100;
    return { title,price,pricePerKg };
  });
  console.log('Walmart Cheese:', walmart.title);
  console.log('Price', walmart.price);
  console.log('Price per kg ($US)', walmart.pricePerKg);

  //Carrefour (France)
  await page.goto('https://www.carrefour.fr/p/fromage-rape-emmental-francais-fondant-carrefour-classic-3560071245986');
  await page.waitForSelector('[data-testid="product-price__amount--main"]');
  const carrefour = await page.evaluate(() => {
    const title = document.querySelector('h1').innerText;
    const price = document.querySelector('[data-testid="product-price__amount--main"]').innerText.replace(/[\n$€]/g, '').replace(/[,]/g, '.');
    const pricePerKg = Math.round(Number(price)*1.03*100)/100;
    return { title,price,pricePerKg };
  });
  console.log('Carrefour Cheese (France):', carrefour.title);
  console.log('Price', carrefour.price);
  console.log('Price per kg ($US)', carrefour.pricePerKg);

  await browser.close();

  try{
    const dataFilePath = path.join(__dirname, 'data.txt');
    const data = await fs.readFile(dataFilePath,'utf8');
    const lines = data.split('\n');
    var woolworthsHistory = [];
    var walmartHistory = [];
    var carrefourHistory = [];
    var edition = 1;
    if (lines.length >= 18) {
      woolworthsHistory = lines[3].replace(/\r/g, '').split(',');
      walmartHistory = lines[8].replace(/\r/g, '').split(',');
      carrefourHistory = lines[13].replace(/\r/g, '').split(',');
      edition = lines[19].replace(/\r/g, '');
    } else {
      res.statusCode = 500;
      res.end('Error corrupted data file');
      return;
    }
    edition = Number(edition)+1;
    woolworthsHistory.pop();
    woolworthsHistory.unshift(woolworths.pricePerKg);
    walmartHistory.pop();
    walmartHistory.unshift(walmart.pricePerKg);
    carrefourHistory.pop();
    carrefourHistory.unshift(carrefour.pricePerKg);

    let currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;
    await fs.writeFile(dataFilePath, 
      'Woolworths:\n'+
      woolworths.title+'\n'+
      woolworths.price+'\n'+
      woolworthsHistory+'\n\n'+
      'Walmart:\n'+
      walmart.title+'\n'+
      walmart.price+'\n'+
      walmartHistory+'\n\n'+
      'Carrefour:\n'+
      carrefour.title+'\n'+
      carrefour.price+'\n'+
      carrefourHistory+'\n\n'+
      'Date\n'+
      formattedDate+'\n\n'+
      'Edition:\n'+
      edition);
  }catch (err){
    console.log(err);
    res.statusCode = 500;
    res.end('Cannot process request');
    return;
  }
};

const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer(async (req,res) => {
  try{
    const iconPath = path.join(__dirname, 'images', 'art.png');
    const previewPath = path.join(__dirname, 'images', 'preview.png');
    
    if (req.url === '/image') {
      try {
        const stats = await fs.stat(iconPath);
        if (stats.isFile()) {
          const imageBuffer = await fs.readFile(iconPath);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.end(imageBuffer);
        } else {
          res.statusCode = 404;
          res.end('Image not found');
        }
      } catch (err) {
        console.log(err)
        res.statusCode = 404;
        res.end('Image not found');
      }
      return;
    }else if (req.url === '/preview') {
      try {
        const stats = await fs.stat(previewPath);
        if (stats.isFile()) {
          const imageBuffer = await fs.readFile(previewPath);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.end(imageBuffer);
        } else {
          res.statusCode = 404;
          res.end('Image not found');
        }
      } catch (err) {
        console.log(err)
        res.statusCode = 404;
        res.end('Image not found');
      }
      return;
    }

    const dataFilePath = path.join(__dirname, 'data.txt');
    const data = await fs.readFile(dataFilePath,'utf8');
    var woolworthsPricePerKg = "Null";
    var walmartPricePerKg = "Null";
    var carrefourPricePerKg = "Null";
    var woolworthsHistory = "";
    var walmartHistory = "";
    var carrefourHistory = "";
    var date = "";
    var edition = "1";

    const lines = data.split('\n');

    if (lines.length >= 18) {
      woolworthsPricePerKg = lines[3].replace(/\r/g, '');
      walmartPricePerKg = lines[8].replace(/\r/g, '');
      carrefourPricePerKg = lines[13].replace(/\r/g, '');
      date = lines[16].replace(/\r/g, '');
      edition = lines[19].replace(/\r/g, '');
    } else {
      res.statusCode = 500;
      res.end('Error corrupted data file');
      return;
    }
    woolworthsHistory = woolworthsPricePerKg.split(',');
    woolworthsPricePerKg = woolworthsHistory[0];

    carrefourHistory = carrefourPricePerKg.split(',');
    carrefourPricePerKg = carrefourHistory[0];

    walmartHistory = walmartPricePerKg.split(',');
    walmartPricePerKg = walmartHistory[0];
    
    const htmlFilePath = path.join(__dirname, 'index.html');
    const html = await fs.readFile(htmlFilePath, 'utf8');

    let htmlContent = html
      .replace('{{WoolworthsPricePerKg}}', woolworthsPricePerKg)
      .replace('{{WalmartPricePerKg}}', walmartPricePerKg)
      .replace('{{CarrefourPricePerKg}}', carrefourPricePerKg)
      .replace('{{date}}', date)
      .replace('((date))', date)
      .replace('((walmartHistory))',walmartHistory.reverse())
      .replace('((woolworthsHistory))',woolworthsHistory.reverse())
      .replace('((carrefourHistory))',carrefourHistory.reverse())
      .replace('{{edition}}',edition);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(htmlContent);
  }catch(err){
    console.log(err);
    res.statusCode = 500;
    res.end('Cannot process request');
    return;
  }
  
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
pollPrices();
const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000
setInterval(() => {
  pollPrices();
}, sevenDaysInMs);