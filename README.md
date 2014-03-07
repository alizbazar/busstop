Bussipysäkillä - [Bussi.Mobi](http://bussi.mobi)
===========================

HSL Bus Stop app that can be used to follow busses approaching the stop. Clicking on a bus you can see a countdown timer for the bus arrival. Try it out yourself:

http://bussi.mobi


## Structure

Currently public-folder is published to S3 using Grunt-task. In the future the idea is to develop a build process, which would minify and concatenate files creating a separate release-ready directory.

Backend is currently relying on PHP, however in the future the idea is to use Node.js for backend operations.

Structure of the frontend code is quite messy and the idea is to structure it with backbone and possible use some mobile-optimized UI framework, such as Chocolate Chip UI. Another possibility could be to implement this using App Gyver in order to package it for distribution in different app stores.


## Contributing

If you would like to contribute to the project in any way, feel free to reach out! Would be great to create a nicer design for the app, as well as perhaps the functionality for selecting a stop from a map or a list. Also other ideas are welcome!