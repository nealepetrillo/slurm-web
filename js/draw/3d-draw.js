/*
 * Copyright (C) 2015 EDF SA
 *
 * This file is part of slurm-web.
 *
 * slurm-web is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * slurm-web is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with slurm-web.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

define([
  'jquery',
  'text!../config/3d.config.json',
  'text!../config/3d.colors.config.json',
  'three',
  'factor-draw',
  'colors-draw',
  'three-orbit-controls',
  'three-first-person-controls',
  'three-pacman-auto'
], function ($, d3Config, d3Colors, THREE, factorDraw, colorsDraw) {
  var config = JSON.parse(d3Config);
  var colors = JSON.parse(d3Colors);

  return function (map, racks, nodes, jobs, room) {
    var self = this;

    this.room = room;
    this.map = map;
    this.racks = racks;
    this.nodes = nodes;
    this.jobs = jobs;

    this.camera;
    this.clock;

    function calculateEnv() {
      self.map.unitWidth = self.map.width * config.UNITSIZE + self.map.rangeMaxRacksNumber * config.UNITSIZE * config.RACKMARGIN;
      self.map.unitHeight = self.map.height * config.UNITSIZE + self.map.rangeNumber * (config.UNITSIZE * config.RACKDEPTH + config.UNITSIZE * config.RACKMARGIN);
    }

    function onMouseDown(event) {
      event.preventDefault();

      var canvasMouseX = event.clientX - self.canvasRectangle.left; 
      var canvasMouseY = event.clientY - self.canvasRectangle.top;

      self.mouse.set((canvasMouseX / self.canvas.width) * 2 - 1, -(canvasMouseY / self.canvas.height) * 2 + 1, 0.5);
      self.mouse.unproject(self.camera);

      self.raycaster.set(self.camera.position, self.mouse.sub(self.camera.position ).normalize());

      var intersects = self.raycaster.intersectObjects( self.scene.children, true );
      for (var i = 0; i < intersects.length; i++) {
        //console.log(intersects[i].object);
      }
    }

    function getMapValue(x, y) {
      return self.map.data[y * self.map.width + x];
    }

    function setControls(canvas) {
      addCamera(canvas);

      switch (self.interfaceOptions.cameraType) {
        case 'fps':
          self.controls = new THREE.FirstPersonControls(self.camera, canvas);
          self.controls.movementSpeed = config.MOVESPEED;
          self.controls.lookSpeed = config.LOOKSPEED;
          self.controls.lookVertical = true;
          self.controls.noFly = true;
          $(self.canvas).on('mousedown', onMouseDown);
        break;
        case 'pacman':
          self.controls = new THREE.PacmanAuto(self.camera, canvas, self.map);
        break;
        default:
          self.controls = new THREE.OrbitControls(self.camera, canvas);
      }

    }

    function addLight() {
      var light = new THREE.AmbientLight(0x404040);
      self.scene.add(light);
    }

    function addWalls() {
      var wallMaterial = new THREE.MeshBasicMaterial({ color: 0xA9A9A9 });

      var topWallGeometry = new THREE.PlaneBufferGeometry(self.floorWidth, config.WALLHEIGHT * config.UNITSIZE, 1, 1);
      var bottomWallGeometry = new THREE.PlaneBufferGeometry(self.floorWidth, config.WALLHEIGHT * config.UNITSIZE, 1, 1);
      var leftWallGeometry = new THREE.PlaneBufferGeometry(self.floorDepth, config.WALLHEIGHT * config.UNITSIZE, 1, 1);
      var rightWallGeometry = new THREE.PlaneBufferGeometry(self.floorDepth, config.WALLHEIGHT * config.UNITSIZE, 1, 1);

      var topWall = new THREE.Mesh(topWallGeometry, wallMaterial);
      var bottomWall = new THREE.Mesh(bottomWallGeometry, wallMaterial);
      var leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
      var rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);

      topWall.position.x = self.floorX;
      topWall.position.z = -(self.floorDepth / 2) + self.floorZ;
      topWall.position.y = config.WALLHEIGHT * config.UNITSIZE / 2;

      bottomWall.position.x = self.floorX;
      bottomWall.position.z = (self.floorDepth / 2) + self.floorZ;
      bottomWall.position.y = config.WALLHEIGHT * config.UNITSIZE / 2;
      bottomWall.rotation.x = 180 * Math.PI / 180;

      leftWall.position.z = self.floorZ;
      leftWall.position.x = -(self.floorWidth / 2) + self.floorX;
      leftWall.position.y = config.WALLHEIGHT * config.UNITSIZE / 2;
      leftWall.rotation.y = 90 * Math.PI / 180;

      rightWall.position.z = self.floorZ;
      rightWall.position.x = (self.floorWidth / 2) + self.floorX;
      rightWall.position.y = config.WALLHEIGHT * config.UNITSIZE / 2;
      rightWall.rotation.y = -90 * Math.PI / 180;

      self.scene.add(topWall);
      self.scene.add(bottomWall);
      self.scene.add(leftWall);
      self.scene.add(rightWall);
    }

    function addFloor() {
      self.floorWidth = self.map.unitWidth;
      self.floorDepth = self.map.unitHeight;
      self.floorX = 0;
      self.floorZ = 0;

      if (room.width * room.rackwidth * config.UNITSIZEMETER > self.floorWidth) {
        self.floorWidth = room.width * room.rackwidth * config.UNITSIZEMETER;
        self.floorX = room.posx * room.rackwidth;
      }

      if (room.depth * room.rackwidth * config.UNITSIZEMETER > self.floorDepth) {
        self.floorDepth = room.depth * room.rackwidth * config.UNITSIZEMETER;
        self.floorZ = room.posy * room.rackwidth;
      }

      var texture = THREE.ImageUtils.loadTexture('static/floor.jpg');
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      var floorMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      var floorGeometry = new THREE.PlaneBufferGeometry(self.floorWidth, self.floorDepth, 1, 1);
      texture.repeat.set(self.floorWidth / (room.rackwidth * config.UNITSIZEMETER), self.floorDepth / (room.rackwidth * config.UNITSIZEMETER));

      var floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = 90 * Math.PI / 180;

      floor.position.x = self.floorX;
      floor.position.z = self.floorZ;

      self.scene.add(floor);
    }

    function addCores(node, x, y, z, nodeWidth, nodeHeight, rackDepth, temperatureCoefficient) {
      var ledDimensions = nodeWidth * config.LEDDIMENSIONS;

      var cpus = self.nodes[node.name].cpus;

      if (!cpus) {
        return
      }

      var geometry;
      var color;
      var material;
      var mesh;
      var jobId;
      var positionX;
      var positionY;
      var positionZ;

      var jobs = [];
      var i;
      if (self.jobs.hasOwnProperty(node.name)) {
        for (jobId in self.jobs[node.name]){
          if (self.jobs[node.name].hasOwnProperty(jobId)) {
            for (i = 0; i < self.jobs[node.name][jobId]; i++) {
              jobs.push(jobId)
            }
          }
        };
      }

      var width = nodeWidth - (3 * ledDimensions);
      var height = nodeHeight;
      var tab = factorDraw.bestFactor(width, height, cpus);
      var row = tab[0];
      var column = tab[1];

      if (row / column === 1) {
        cpuDimensions = Math.min(width, height);
        var cpuDepth = nodeWidth * config.CPUDEPTH;
      } else {
        var cpuDimensions = width / column;
        var cpuDepth = nodeWidth * config.CPUDEPTH;
      }

      var factorWidth = column * cpuDimensions;
      var factorHeight = row * cpuDimensions;

      var cpuPadding = cpuDimensions * config.CPUPADDING;
      for (cpu = 0; cpu < cpus; cpu++) {
        geometry = new THREE.BoxGeometry(cpuDimensions - cpuPadding, cpuDimensions - cpuPadding, cpuDepth);
        geometry = new THREE.BufferGeometry().fromGeometry(geometry);

        if (!jobs[cpu]) {
          color = colors.NOJOB;
        } else {
          color = colorsDraw.findJobColor(jobs[cpu], '3D');
        }

        material = new THREE.MeshBasicMaterial({ color: color });
        mesh = new THREE.Mesh(geometry, material);

        positionX = x - -temperatureCoefficient * (factorWidth / 2) + ledDimensions * -temperatureCoefficient + -temperatureCoefficient * (cpuDimensions / 2) + -temperatureCoefficient * (Math.floor(cpu % column) * cpuDimensions);
        positionY = y + (factorHeight / 2) - (Math.floor(cpu / column) * cpuDimensions) - (cpuDimensions / 2);
        positionZ = z - (rackDepth / 2) * temperatureCoefficient;

        mesh.position.x = positionX;
        mesh.position.y = positionY;
        mesh.position.z = positionZ;

        self.scene.add(mesh);
      }
    }

    function addLed(node, x, y, z, nodeWidth, nodeHeight, rackDepth, temperatureCoefficient) {
      var ledDimensions = nodeWidth * config.LEDDIMENSIONS;
      var ledDepth = nodeWidth * config.LEDDEPTH;

      var geometry = new THREE.BoxGeometry(ledDimensions, ledDimensions, ledDepth);
      geometry = new THREE.BufferGeometry().fromGeometry(geometry);

      var material = new THREE.MeshBasicMaterial({ color: colorsDraw.findLedColor(self.nodes[node.name], '3D').state });
      var mesh = new THREE.Mesh(geometry, material);

      mesh.position.x = x - ((nodeWidth / 2) - (ledDimensions + 0.5 * ledDimensions)) * -1 * temperatureCoefficient;
      mesh.position.y = y;
      mesh.position.z = z - (rackDepth / 2) * temperatureCoefficient;

      self.scene.add(mesh);
    }

    function addNode(node, x, y, z, temperatureCoefficient) {
      var nodeWidth = node.width * (config.RACKWIDTH - 2 * config.RACKPADDING - 2 * config.NODEPADDINGLEFTRIGHT) * config.UNITSIZE;
      var nodeX = node.posx * (config.RACKWIDTH - 2 * config.RACKPADDING + config.NODEPADDINGLEFTRIGHT) * config.UNITSIZE;
      var nodeHeight = node.height * config.RACKHEIGHT * config.UNITSIZE;
      nodeHeight -= nodeHeight * config.NODEPADDINGTOP;
      var nodeY = node.posy * config.RACKHEIGHT * config.UNITSIZE;
      nodeDepth = config.RACKDEPTH * config.UNITSIZE - 2 * config.RACKDEPTH * config.UNITSIZE * config.RACKPADDING;

      var geometry = new THREE.BoxGeometry(nodeWidth, nodeHeight, nodeDepth);
      geometry = new THREE.BufferGeometry().fromGeometry(geometry);
      var material = new THREE.MeshBasicMaterial({ color: colors.NODE });
      var mesh = new THREE.Mesh(geometry, material);

      var positionX = x - -temperatureCoefficient * ((config.RACKWIDTH - 2 * config.RACKPADDING) * config.UNITSIZE / 2) + -temperatureCoefficient * nodeX + -temperatureCoefficient * (nodeWidth / 2);
      var positionY = y + (config.RACKHEIGHT * config.UNITSIZE / 2) + nodeY + (nodeHeight / 2);
      var positionZ = z + -temperatureCoefficient * (config.RACKDEPTH * config.UNITSIZE * 0.006 + config.RACKDEPTH * config.UNITSIZE * config.RACKPADDING);

      mesh.position.x = positionX;
      mesh.position.y = positionY;
      mesh.position.z = positionZ;

      positionZ = z + -temperatureCoefficient * (config.RACKDEPTH * config.UNITSIZE * 0.006);

      self.scene.add(mesh);

      addLed(node, positionX, positionY, positionZ, nodeWidth, nodeHeight, config.RACKDEPTH * config.UNITSIZE, temperatureCoefficient);
      //addCores(node, positionX, positionY, positionZ, nodeWidth, nodeHeight, config.RACKDEPTH * config.UNITSIZE, temperatureCoefficient);
    }

    function addRack() {
      var rack;
      var positionX;
      var positionY;
      var positionZ;

      var geometry;
      var texture = THREE.ImageUtils.loadTexture('static/rack.jpg');
      texture.repeat.set(1, 1, 1);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      var material = new THREE.MeshBasicMaterial({ map: texture });
      var mesh;

      var x;
      var y;
      var range = 1;
      var currentRange = 1;
      var temperatureCoefficient = 1;
      var index;
      for (y = 0; y < self.map.height; y++) {
        for (x = 0; x < self.map.width; x++) {
          if (getMapValue(x, y) !== 1 && getMapValue(x, y) !== 0 && self.racks.hasOwnProperty(getMapValue(x, y))) {
            rack = self.racks[getMapValue(x, y)];

            if (x === 1 + config.PATHSIZE * 2) {
              range++;
            }

            if (range !== currentRange) {
              temperatureCoefficient *= -1;
              currentRange = range;
            }

            positionX = (x - (self.map.width - 1) / 2) * (config.UNITSIZE * config.RACKWIDTH + config.UNITSIZE * config.RACKMARGIN);
            positionY = (config.UNITSIZE * config.RACKHEIGHT / 2);
            positionZ = (y - (self.map.height - 1) / 2) * (config.UNITSIZE * config.RACKDEPTH + config.UNITSIZE * config.RACKMARGIN);

            for (index in rack.nodes) {
              if (rack.nodes.hasOwnProperty(index)) {
                addNode(rack.nodes[index], positionX, positionY, positionZ, temperatureCoefficient);
              }
            }

            geometry = new THREE.BoxGeometry(
              config.UNITSIZE * config.RACKWIDTH,
              (self.map.altitude + 1) * config.UNITSIZE * config.RACKHEIGHT,
              config.UNITSIZE * config.RACKDEPTH
            );

            mesh = new THREE.Mesh(geometry, material);

            mesh.position.x = positionX;
            mesh.position.y = ((self.map.altitude + 1) * config.UNITSIZE * config.RACKHEIGHT / 2);
            mesh.position.z = positionZ;

            self.scene.add(mesh);
          }
        }
      }
    }

    function addCamera() {
      var x = 0;
      var y = 0;
      var z = 0;

      switch (self.interfaceOptions.cameraType) {
        case 'fps':
          x = -((self.map.width * config.UNITSIZE) / 2) + ((config.PATHSIZE / 2) * config.UNITSIZE);
          y = self.map.altitude * config.RACKHEIGHT * config.UNITSIZE / 2;
          z = 0;
        break;
        default:
          x = -(self.map.width * config.UNITSIZE);
          y = self.map.altitude * config.RACKHEIGHT * config.UNITSIZE / 2;
          z = 0;
      }

      self.camera = new THREE.PerspectiveCamera(45, self.canvas.width / self.canvas.height, 0.1, 10000);
      self.camera.position.set(x, y, z);
      self.scene.add(self.camera);
    }

    function render() {
      if (self.idFrame !== false) {
        var delta = self.clock.getDelta();
        self.controls.update(delta);
        self.idFrame = requestAnimationFrame(render);
        self.renderer.render(self.scene, self.camera);
      } else {
        cancelAnimationFrame(self.idFrame);
      }
    }

    this.init = function (canvas) {
      this.idFrame = null;
      this.canvas = canvas;
      this.interfaceOptions = {
        cameraType: 'orbit',
        screenType: 'page'
      };

      this.clock = new THREE.Clock();
      this.mouse = new THREE.Vector3();
      this.raycaster = new THREE.Raycaster();
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      this.scene = new THREE.Scene();

      this.canvasRectangle = this.renderer.domElement.getBoundingClientRect();

      setControls(this.canvas);

      $(document).on('camera-change', function (e, options) {
        self.interfaceOptions.cameraType = options.cameraType;

        setControls(self.canvas);
      });

      $(document).on('screen-change', function (e, options) {
        self.interfaceOptions.screenType = options.screenType;

        setControls(self.canvas);
      });

      $(document).on('fullscreen-enter', function (e) {
        self.camera.aspect = $(window).width() / $(window).height();
        self.camera.updateProjectionMatrix();

        self.renderer.setSize($(window).width(), $(window).height());
      });

      $(document).on('fullscreen-exit', function (e, options) {
        self.camera.aspect = options.canvas.width / options.canvas.height;
        self.camera.updateProjectionMatrix();

        self.renderer.setSize(options.canvas.width, options.canvas.height);
      });

      $(document).on('canvas-size-change', function (e, options) {
        self.camera.aspect = options.canvas.width / options.canvas.height;
        self.camera.updateProjectionMatrix();

        self.renderer.setSize(options.canvas.width, options.canvas.height);
      });

      $(document).one('three-destroy', function() {
        if (self.idFrame) {
          self.idFrame = false;

          $(document).off('contextmenu');
          $(document).off('mousedown');
          $(document).off('mousewheel');
          $(document).off('DOMMouseScroll');
          $(document).off('keydown');
          $(document).off('touchstart');
          $(document).off('touchend');
          $(document).off('touchmove');

          $(document).on('mousemove');
          $(document).on('mouseup');

          $(document).off('keydown');
          $(document).off('keyup');

          $(self.canvas).off('mousedown');
        }
      });

      calculateEnv();
      addFloor();
      addWalls();
      addRack();

      if (config.DEBUG) {
        this.scene.add(new THREE.AxisHelper(100));
      }

      render();
    }

    return this;
  };
});