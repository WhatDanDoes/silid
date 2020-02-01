// src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import * as serviceWorker from './serviceWorker';
import './index.css';

//console.log('INDEX LOADING');
//console.log(process.env.NODE_ENV);
///**
// * 2020-1-28 https://dev.to/matsilva/fetch-api-gotcha-in-cypress-io-and-how-to-fix-it-7ah
// */
//if (process.env.NODE_ENV === 'development') {
//console.log('USING FETCH POLYFILL');
//  require('whatwg-fetch'); //for polyfill cypress test 
//}


ReactDOM.render(<App />, document.getElementById('root'));

serviceWorker.unregister();
