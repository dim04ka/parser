const express = require('express');

const app = express();
const axios = require('axios');
const uuid = require('uuid');
const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const credentials = require('./key.json');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

admin.initializeApp({
    credential: admin.credential.cert(credentials),
    storageBucket: "gs://mara-b5982.appspot.com"
})
const db = admin.firestore();
const token = '6704239325:AAHZMAyo92DAJuUYmtWth0NQEZAMw9S7KG8';
const chatId = '-1002144996647';
async function getBotUpdates () {
    const parserCollection = db.collection('parser');
    const elements = await parserCollection.get();
    let elementsArray = [];
    elements.forEach((doc) => {
        elementsArray.push(doc.data());
    })

    const parserSentCollection = db.collection('parser-sent');
    const elementsSent = await parserSentCollection.get();
    let elementsSentArray = [];

    elementsSent.forEach((doc) => {
        elementsSentArray.push(doc.data());
    })


    for(let elem of elementsArray){
        if(!elementsSentArray[0].ids.includes(elem.id)){
            axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
                chat_id: chatId,
                photo: elem.image,
                caption: `${elem.date} ${elem.phone} - ${elem.title} - ${elem.description} - price:${elem.price}`
            })
                .then(async function (response) {
                    const userRef = await db.collection("parser-sent").doc('nqgFIUARWVg26mcLMtB4')
                        .update({
                            ids:[...elementsSentArray[0].ids, elem.id]
                        })
                })
                .catch(function (error) {
                    console.error('Error sending photo to Telegram:', error);
                });
        }
    }

}

async function start() {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto('https://www.myparts.ge/ka/search/?pr_type_id=3&page=1&cat_id=765');

    await page.setViewport({width: 1080, height: 1024});

    await page.waitForSelector('#root > div.custom-modal-container.undefined > div > div.custom-modal-inner.fixed-mobile')
    await page.click('#root > div.custom-modal-container.undefined > div > div.custom-modal-inner.fixed-mobile > button');
    // await page.screenshot({path: 'example.png'});
    const elements = await page.$$('div.row a.text-dark')


    const data = [];
    for (const element of elements) {


        const timeElement = await element.$('.bot_content div div');
        const time = await timeElement.evaluate(el => {
            const regex = /(\d{2}\.\d{2}\.\d{4})/; // Регулярное выражение для поиска даты в формате dd.mm.yyyy
            const match = el.innerText.match(regex); // Поиск соответствия регулярному выражению
            return match ? match[0] : null; // Возвращаем найденную дату или null, если ничего не найдено
        });


        const currentDate = new Date();

        const day = String(currentDate.getDate()).padStart(2, '0'); // День месяца
        const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Месяц (начинается с 0)
        const year = currentDate.getFullYear(); // Год

        const formattedDate = `${day}.${month}.${year}`;

        // if (time !== formattedDate) break;
        if (time === '12.02.2024') break;
        const href = await element.evaluate(el => el.href);

        const newPage = await browser.newPage();
        await newPage.goto(href);

        const yourElement = await newPage.$('.shadow-filter-options-all i.stroke-bluepart-100');
        if (yourElement) {
            await yourElement.click()
            await delay(500)

            const phoneElement = await newPage.$('.shadow-filter-options-all a[href^="tel"]');
            const phone = await newPage.evaluate(el => el.href, phoneElement);

            const titleElement = await newPage.$('div.mb-16px.text-overflow-ellipses-3-line.font-size-md-24.font-size-16.font-TBCX-bold')
            const title = await newPage.evaluate(el => el.innerText, titleElement);

            const descriptionElement = await newPage.$('.custom-scroll-bar.custom-scroll-bar-animated')
            const description = await newPage.evaluate(el => el.innerText, descriptionElement);

            const imageElement = await newPage.$('div.swiper-wrapper img');
            const image = await newPage.evaluate(el => el.src, imageElement);

            const priceElement = await newPage.$('.shadow-filter-options-all span')
            const price = await newPage.evaluate(el => el.innerHTML, priceElement);

            const dateElement = await newPage.$('.mb-24px.font-TBCX-medium.font-size-12')
            const date = await newPage.evaluate(el => el.children[1].innerText, dateElement);

            const idElement = await newPage.$('.mb-24px.font-TBCX-medium.font-size-12')
            const id = await newPage.evaluate(el => el.children[2].innerText, idElement);
            console.log('id', id);

            data.push({phone, title, description: description || '', image, price, date, id})
        }
        await newPage.close();
    }

    await browser.close();

    async function firestoreData() {

        const snapshot = await db.collection("parser").get(); // Получаем все документы в коллекции
        const promises = []; // Массив обещаний для удаления каждого документа
        snapshot.forEach(doc => {
            const promise = db.collection("parser").doc(doc.id).delete(); // Удаление документа
            promises.push(promise);
        });
        await Promise.all(promises);

        for(let i = 0; i < data.length; i++) {





            const uniqueId = uuid.v4();
            const userJson = {
                image: data[i].image,
                price: data[i].price,
                title: data[i].title,
                phone: data[i].phone,
                description: data[i].description,
                date: data[i].date,
                id: data[i].id,
            }
            const response = await db.collection('parser').doc(uniqueId).set(userJson);
        }
    }
    await firestoreData()

    await getBotUpdates()
}


const PORT = process.env.PORT || 8080;



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // start()
    setInterval(()=> {
        start()
        console.log('running')
    }, 100000)
})

console.log('Server running on')




