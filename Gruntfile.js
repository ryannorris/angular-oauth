'use strict';

module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    library: grunt.file.readJSON('bower.json'),
    concat: {
      options: {
        separator: ''
      },
      library: {
        src: ['src/<%= pkg.name %>.js', 'src/providers/*.js'],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy")     %> */\n'
      },
      jid: {
        files: {
          'dist/<%= library.name %>.min.js': ['<%= concat.library.dest %>']
        }
      }
    },
    jshint: {
      options: {
        curly: true,
        node: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        globals: {
          jQuery: true,
          module: true,
          window: true,
          localStorage: true,
          angular: true
        }
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      src_test: {
        src: ['src/**/*.js', 'test/**/*.js']
      }
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile']
      },
      src_test: {
        files: '<%= jshint.srcTest.src %>',
        tasks: ['jshint:srcTest']
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task.
  grunt.registerTask('default', ['jshint', 'concat', 'uglify']);
};
