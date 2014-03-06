BusStop - Bussipysäkillä
========================

HSL Bus Stop app that can be used to follow busses approaching the stop. Clicking on a bus you can see a countdown for the bus arrival.

## Contributing

If you would like to contribute for the project in any way, please reveal yourself! :) Would be great to create a nicer design for the app, as well as perhaps a functionality for selecting a stop somehow. Also other ideas are welcome!


## Structure

Currently public-folder is published to S3. In the future the idea is to develop a build process, which would minify and concatene files creating a separate release-ready directory.

Backend is currently relying on PHP, however in the future the idea would be to use Node.js for backend operations.

Structure of the frontend code is quite messy and the idea is to structure it with backbone and possible use some mobile-optimized UI framework, such as Chocolate Chip UI. Another possibility could be to implement this using App Gyver in order to package it for distribution in different app stores.

Grunt task is to be created for publishing changes to S3.