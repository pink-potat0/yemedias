(function () {
    var ALBUM_COVERS = [
        "donda2.jpg",
        "GOODASSJOB.jpg",
        "loveeveryone.jpg",
        "jesusisking2.jpg",
        "sohelpmeGOD.jpg",
        "swish.jpg",
        "yahndi.jpg",
        "yeezus2.jpg"
    ];

    var container = document.getElementById("album-covers");
    if (!container) return;

    var basePath = "albumcvers/";
    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    var behaviors = [
        { name: "tilt-heavy", tiltX: 1, tiltY: 1, parallax: 0 },
        { name: "parallax-heavy", tiltX: 0.2, tiltY: 0.2, parallax: 1.4 },
        { name: "wobble", tiltX: 1.2, tiltY: 0.4, parallax: 0.5 },
        { name: "opposite", tiltX: -0.9, tiltY: -0.9, parallax: -0.6 },
        { name: "vertical-only", tiltX: 1.1, tiltY: 0, parallax: 0.3 },
        { name: "horizontal-only", tiltX: 0, tiltY: 1.1, parallax: 0.4 },
        { name: "slow-drift", tiltX: 0.5, tiltY: 0.5, parallax: 0.8 },
        { name: "snap", tiltX: 1.3, tiltY: 1.3, parallax: 0.2 }
    ];

    var leftPositions = [
        { left: 18, top: 22 },
        { left: 22, top: 55 },
        { left: 28, top: 78 },
        { left: 35, top: 38 }
    ];
    var rightPositions = [
        { left: 65, top: 38 },
        { left: 72, top: 78 },
        { left: 78, top: 55 },
        { left: 82, top: 22 }
    ];
    var allPositions = leftPositions.concat(rightPositions);

    var sharedTransition = "transform 0.14s ease-out 0s";

    ALBUM_COVERS.forEach(function (filename, i) {
        var img = document.createElement("img");
        img.src = basePath + filename;
        img.alt = "";
        img.className = "album-cover";
        img.dataset.index = String(i);

        var pos = allPositions[i % allPositions.length];
        var size = randomBetween(100, 132);
        var leftJitter = randomBetween(-3, 3);
        var topJitter = randomBetween(-4, 4);
        img.style.width = size + "px";
        img.style.height = size + "px";
        img.style.left = (pos.left + leftJitter) + "%";
        img.style.top = (pos.top + topJitter) + "%";
        img.style.transform = "translate(-50%, -50%)";
        img.style.transition = sharedTransition;

        var b = pick(behaviors);
        img._tiltX = 12 + randomBetween(0, 10);
        img._tiltY = 12 + randomBetween(0, 10);
        img._tiltWeightX = b.tiltX;
        img._tiltWeightY = b.tiltY;
        img._parallax = 4 + randomBetween(0, 6);
        img._parallaxWeight = b.parallax;
        img._phaseX = randomBetween(0.85, 1.15);
        img._phaseY = randomBetween(0.85, 1.15);

        img.onerror = function () { this.style.display = "none"; };
        container.appendChild(img);
    });

    function updateTransforms(e) {
        var x = e.clientX;
        var y = e.clientY;
        var dx = (x - centerX) / centerX;
        var dy = (y - centerY) / centerY;

        var covers = container.querySelectorAll(".album-cover");
        covers.forEach(function (img) {
            if (img.style.display === "none") return;

            var rx = dy * img._tiltX * img._tiltWeightX * img._phaseX;
            var ry = -dx * img._tiltY * img._tiltWeightY * img._phaseY;
            var tx = dx * img._parallax * img._parallaxWeight;
            var ty = dy * img._parallax * img._parallaxWeight;

            img.style.transform = "translate(calc(-50% + " + tx + "px), calc(-50% + " + ty + "px)) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
        });
    }

    function updateTransformsFromGyro(beta, gamma) {
        if (beta == null || gamma == null) return;
        var covers = container.querySelectorAll(".album-cover");
        covers.forEach(function (img) {
            if (img.style.display === "none") return;
            var rx = (beta - 90) * 0.35 * img._tiltWeightX * img._phaseX;
            var ry = gamma * 0.4 * img._tiltWeightY * img._phaseY;
            var tx = gamma * 0.8 * img._parallaxWeight;
            var ty = (beta - 90) * 0.5 * img._parallaxWeight;
            img.style.transform = "translate(calc(-50% + " + tx + "px), calc(-50% + " + ty + "px)) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
        });
    }

    var isMobile = function () {
        return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    };
    var gyroActive = false;
    var permissionAsked = false;

    function tryEnableGyro() {
        if (!isMobile() || gyroActive || !window.DeviceOrientationEvent) return;
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            if (permissionAsked) return;
            permissionAsked = true;
            DeviceOrientationEvent.requestPermission()
                .then(function (state) {
                    if (state === "granted") {
                        startGyro();
                    }
                })
                .catch(function () {});
            return;
        }
        startGyro();
    }

    function startGyro() {
        if (gyroActive) return;
        gyroActive = true;
        window.addEventListener("deviceorientation", function (e) {
            if (e.beta != null && e.gamma != null) {
                updateTransformsFromGyro(e.beta, e.gamma);
            }
        }, { passive: true });
    }

    document.addEventListener("mousemove", function (e) {
        if (isMobile() && gyroActive) return;
        updateTransforms(e);
    });
    document.addEventListener("touchstart", function (e) {
        if (e.touches.length && isMobile()) tryEnableGyro();
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
        if (e.touches.length) {
            if (isMobile() && gyroActive) return;
            updateTransforms({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        }
    }, { passive: true });
    window.addEventListener("resize", function () {
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight / 2;
    });
})();
