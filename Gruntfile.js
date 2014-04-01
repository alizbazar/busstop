/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    privateConfig: grunt.file.readJSON('private-config.json'),

    manifest: {
      generate: {
        options: {
          basePath: 'public/',
          cache: [
            // LIST HERE ALL INTERNAL EXPLICIT DEPENDENCIES
            'icons/star-icon-36.png',
            'icons/star-icon-empty-36.png',
            // LIST HERE ALL EXTERNAL DEPENDENCIES
            // TODO: this could probably be done automatically with using require.js
            '//netdna.bootstrapcdn.com/bootstrap/3.1.1/css/bootstrap.min.css',
            '//ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js',
            '//cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.13.3/jquery.tablesorter.min.js',
            '//cdnjs.cloudflare.com/ajax/libs/jquery-countdown/1.6.3/jquery.countdown.min.js'
          ],
          network: ['*'],
          // fallback: ['/ /offline.html'],
          // exclude: ['js/jquery.min.js'],
          // preferOnline: true,
          verbose: true,
          timestamp: true,
          // hash: true,
          // master: ['index.html'] 
        },
        src: [
          'index.html',
          'app.js',
          'taffy-min.js',
          'typeahead.jquery.js',
          'styles.css'
        ],
        dest: 'manifest.appcache'
      }
    },

    aws_s3: {
      options: {
        accessKeyId: '<%= privateConfig.awsKey %>', // Use the variables
        secretAccessKey: '<%= privateConfig.awsSecret %>', // You can also use env variables
        region: '<%= privateConfig.awsRegion %>',
        access: 'public-read',
        uploadConcurrency: 5, // 5 simultaneous uploads
        downloadConcurrency: 5 // 5 simultaneous downloads
      },

      production: {
        options: {
          bucket: '<%= privateConfig.awsBucket %>',
          differential: true // Only uploads the files that have changed
        },
        files: [
          {expand: true, cwd: 'public/', src: ['**', '!manifest.appcache'], dest: ''},
          {expand: true, cwd: '', src: ['manifest.appcache'], dest: '', params: {"CacheControl": "no-cache"} }
        ]
      },

      staging: {
        options: {
          bucket: '<%= privateConfig.awsStagingBucket %>',
          differential: true // Only uploads the files that have changed
        },
        files: [
          {expand: true, cwd: 'public/', src: ['**', '!manifest.appcache', '!timetables/'], dest: 'busatstop/'},
          // {expand: true, cwd: 'public/', src: ['manifest.appcache'], dest: '', params: {"CacheControl": "no-cache"} }
        ]
      },
    },
    // concat: {
    //   options: {
    //     banner: '<%= banner %>',
    //     stripBanners: true
    //   },
    //   dist: {
    //     src: ['lib/<%= pkg.name %>.js'],
    //     dest: 'dist/<%= pkg.name %>.js'
    //   }
    // },
    // uglify: {
    //   options: {
    //     banner: '<%= banner %>'
    //   },
    //   dist: {
    //     src: '<%= concat.dist.dest %>',
    //     dest: 'dist/<%= pkg.name %>.min.js'
    //   }
    // },
    // jshint: {
    //   options: {
    //     curly: true,
    //     eqeqeq: true,
    //     immed: true,
    //     latedef: true,
    //     newcap: true,
    //     noarg: true,
    //     sub: true,
    //     undef: true,
    //     unused: true,
    //     boss: true,
    //     eqnull: true,
    //     browser: true,
    //     globals: {}
    //   },
    //   gruntfile: {
    //     src: 'Gruntfile.js'
    //   },
    //   lib_test: {
    //     src: ['lib/**/*.js', 'test/**/*.js']
    //   }
    // },
    // qunit: {
    //   files: ['test/**/*.html']
    // },
    // watch: {
    //   gruntfile: {
    //     files: '<%= jshint.gruntfile.src %>',
    //     tasks: ['jshint:gruntfile']
    //   },
    //   lib_test: {
    //     files: '<%= jshint.lib_test.src %>',
    //     tasks: ['jshint:lib_test', 'qunit']
    //   }
    // }
  });

  // These plugins provide necessary tasks.
  // grunt.loadNpmTasks('grunt-contrib-concat');
  // grunt.loadNpmTasks('grunt-contrib-uglify');
  // grunt.loadNpmTasks('grunt-contrib-qunit');
  // grunt.loadNpmTasks('grunt-contrib-jshint');
  // grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-aws-s3');
  grunt.loadNpmTasks('grunt-manifest');

  // Default task.
  // grunt.registerTask('default', ['jshint', 'qunit', 'concat', 'uglify']);

  grunt.registerTask('upload', ['manifest', 'aws_s3:production']);

  grunt.registerTask('stage', ['aws_s3:staging']);
};
