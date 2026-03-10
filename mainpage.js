(function () {
    var data = { albums: [], lpsMvs: [] };
    var currentView = "unrlsd";
    var currentTrackIndex = 0;
    var currentAlbum = null;
    var expandedAlbum = null;
    var currentVideoAlbum = null;
    var currentVideoIndex = 0;
    var shuffleEnabled = false;
    var repeatMode = "none"; // "none" | "all" | "one"
    var FAVOURITES_KEY = "kanyestream_favourites";

    function getFavourites() {
        try {
            var raw = localStorage.getItem(FAVOURITES_KEY);
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function setFavourites(arr) {
        try {
            localStorage.setItem(FAVOURITES_KEY, JSON.stringify(arr));
        } catch (e) {}
    }

    function addToFavourites(albumId, trackIndex) {
        var fav = getFavourites();
        if (fav.some(function (e) { return e.albumId === albumId && e.trackIndex === trackIndex; })) return;
        fav.push({ albumId: albumId, trackIndex: trackIndex });
        setFavourites(fav);
    }

    function removeFromFavourites(albumId, trackIndex) {
        var t = Number(trackIndex);
        var fav = getFavourites().filter(function (e) {
            return !(e.albumId === albumId && Number(e.trackIndex) === t);
        });
        setFavourites(fav);
    }

    function isTrackFavourited(albumId, trackIndex) {
        var t = Number(trackIndex);
        return getFavourites().some(function (e) {
            return e.albumId === albumId && Number(e.trackIndex) === t;
        });
    }

    function getFavouritesAlbum() {
        var fav = getFavourites();
        if (!fav.length || !data.albums.length) return null;
        var tracks = [];
        var coverPath = "";
        for (var i = 0; i < fav.length; i++) {
            var e = fav[i];
            var album = data.albums.find(function (a) { return a.id === e.albumId; });
            if (!album || !album.tracks || !album.tracks[e.trackIndex]) continue;
            var t = album.tracks[e.trackIndex];
            if (!coverPath) coverPath = album.coverPath;
            tracks.push({
                title: t.title,
                audioPath: t.audioPath,
                albumTitle: album.title,
                albumId: album.id,
                trackIndex: e.trackIndex,
                coverPath: album.coverPath
            });
        }
        if (!tracks.length) return null;
        return {
            id: "_favourites",
            title: "Favourites",
            coverPath: "albumcvers/fav.jpg",
            tracks: tracks
        };
    }

    var gridEl = document.querySelector(".mainpage .covers-grid");
    var sidebarEl = document.querySelector(".mainpage .sidebar-menu");
    var searchEl = document.querySelector(".mainpage .topbar-search");

    if (!gridEl) return;

    function getBaseUrl() {
        var a = document.createElement("a");
        a.href = window.location.href;
        var path = a.pathname || "";
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash > -1) path = path.slice(0, lastSlash + 1);
        return window.location.origin + path;
    }

    function loadData() {
        var base = getBaseUrl();
        return fetch(base + "data/albums.json")
            .then(function (res) { return res.json(); })
            .then(function (json) {
                data.albums = json.albums || [];
                data.lpsMvs = json.lpsMvs || [];
            });
    }

    function filterBySearch(items, query) {
        if (!query || !query.trim()) return items;
        var q = query.trim().toLowerCase();
        return items.filter(function (a) {
            var titleMatch = (a.title || "").toLowerCase().indexOf(q) > -1;
            if (a.tracks && a.tracks.length) {
                var trackMatch = a.tracks.some(function (t) {
                    return (t.title || "").toLowerCase().indexOf(q) > -1;
                });
                return titleMatch || trackMatch;
            }
            return titleMatch;
        });
    }

    /** Returns array of { track, album, trackIndex } for all tracks whose title matches the query. */
    function getMatchingTracks(query) {
        if (!query || !query.trim()) return [];
        var q = query.trim().toLowerCase();
        var results = [];
        var albums = data.albums.slice();
        var favAlbum = getFavouritesAlbum();
        if (favAlbum) albums.unshift(favAlbum);
        albums.forEach(function (album) {
            if (!album.tracks || !album.tracks.length) return;
            album.tracks.forEach(function (track, idx) {
                if ((track.title || "").toLowerCase().indexOf(q) === -1) return;
                var realAlbum = album;
                var realTrackIndex = idx;
                if (album.id === "_favourites") {
                    realAlbum = data.albums.find(function (a) { return a.id === track.albumId; });
                    realTrackIndex = track.trackIndex;
                    if (!realAlbum || !realAlbum.tracks || !realAlbum.tracks[realTrackIndex]) return;
                }
                results.push({
                    track: realAlbum.tracks[realTrackIndex],
                    album: realAlbum,
                    trackIndex: realTrackIndex
                });
            });
        });
        return results;
    }

    function setView(view) {
        currentView = view;
        var btns = sidebarEl ? sidebarEl.querySelectorAll(".sidebar-btn") : [];
        btns.forEach(function (btn) {
            btn.classList.toggle("is-active", btn.dataset.view === view);
        });
        renderGrid();
    }

    function initSidebar() {
        if (!sidebarEl) return;
        sidebarEl.querySelectorAll(".sidebar-btn[data-view]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setView(btn.dataset.view);
                document.body.classList.remove("menu-open");
            });
        });
        var menuBtn = document.getElementById("topbar-menu-btn");
        var overlay = document.getElementById("sidebar-overlay");
        var closeBtn = document.getElementById("sidebar-close-btn");
        if (menuBtn) {
            menuBtn.addEventListener("click", function () {
                var open = document.body.classList.toggle("menu-open");
                menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
            });
        }
        function closeMenu() {
            document.body.classList.remove("menu-open");
            if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
        }
        if (overlay) overlay.addEventListener("click", closeMenu);
        if (closeBtn) closeBtn.addEventListener("click", closeMenu);
        
    }

    function playAlbum(album) {
        if (!album.tracks || !album.tracks.length) return;
        if (album.id === "_favourites") {
            var first = album.tracks[0];
            var realAlbum = data.albums.find(function (a) { return a.id === first.albumId; });
            if (!realAlbum) return;
            currentAlbum = realAlbum;
            currentTrackIndex = first.trackIndex;
            expandedAlbum = album;
            var track = realAlbum.tracks[first.trackIndex];
            var audio = document.getElementById("mainpage-audio");
            if (audio) {
                audio.src = track.audioPath;
                audio.play().catch(function () {});
            }
            updatePlayerUI();
            return;
        }
        currentAlbum = album;
        currentTrackIndex = 0;
        expandedAlbum = album;
        var track = album.tracks[0];
        var audio = document.getElementById("mainpage-audio");
        if (audio) {
            audio.src = track.audioPath;
            audio.play().catch(function () {});
        }
        updatePlayerUI();
    }

    function openVideoPlayer(album, startIndex) {
        var isPlaylist = album.videos && album.videos.length && typeof startIndex === "number";
        var idx = isPlaylist ? Math.min(Math.max(0, startIndex), album.videos.length - 1) : 0;
        if (isPlaylist) {
            currentVideoAlbum = album;
            currentVideoIndex = idx;
        }
        var videoUrl = isPlaylist ? album.videos[idx].videoUrl : album.videoUrl;
        if (!videoUrl) return;
        
        // Pause any currently playing audio
        var audio = document.getElementById("mainpage-audio");
        if (audio && !audio.paused) {
            audio.pause();
            updatePlayPauseButtons();
        }
        
        function getEmbedUrl(url) {
            if (url && url.indexOf("bilibili.com/video/") !== -1) {
                var m = url.match(/\/video\/(BV\w+)/);
                if (m && m[1]) return "https://player.bilibili.com/player.html?bvid=" + m[1] + "&autoplay=false&page=1";
            }
            return url || "";
        }
        
        videoUrl = getEmbedUrl(videoUrl);
        
        var displayTitle = isPlaylist ? album.videos[idx].title : (album.fullTitle || album.title || "Video Player");
        // Create video player modal with native styling
        var modal = document.createElement('div');
        modal.className = 'video-player-modal';
        modal.setAttribute('aria-hidden', 'false');
        
        var backdrop = document.createElement('div');
        backdrop.className = 'video-player-backdrop';
        
        var container = document.createElement('div');
        container.className = 'video-player-container';
        
        var header = document.createElement('div');
        header.className = 'video-player-header';
        
        var title = document.createElement('span');
        title.className = 'video-player-title';
        title.textContent = displayTitle;
        
        var closeBtn = document.createElement('button');
        closeBtn.className = 'video-player-close';
        closeBtn.setAttribute('aria-label', 'Close video player');
        closeBtn.innerHTML = '<img src="playericon/icons8-cancel-48.png" alt="" class="video-player-close-icon">';
        closeBtn.addEventListener('click', function() {
            closeVideoPlayer();
        });
        
        header.appendChild(title);
        if (isPlaylist && album.videos.length > 1) {
            var prevVideoBtn = document.createElement('button');
            prevVideoBtn.className = 'video-player-prev';
            prevVideoBtn.setAttribute('aria-label', 'Previous video');
            prevVideoBtn.innerHTML = '<img src="playericon/icons8-skip-to-start-48.png" alt="" class="video-player-nav-icon">';
            prevVideoBtn.style.display = idx === 0 ? 'none' : '';
            var nextVideoBtn = document.createElement('button');
            nextVideoBtn.className = 'video-player-next';
            nextVideoBtn.setAttribute('aria-label', 'Next video');
            nextVideoBtn.innerHTML = '<img src="playericon/icons8-skip-48.png" alt="" class="video-player-nav-icon">';
            nextVideoBtn.style.display = idx === album.videos.length - 1 ? 'none' : '';
            prevVideoBtn.addEventListener('click', function() {
                if (currentVideoIndex <= 0) return;
                currentVideoIndex--;
                var v = album.videos[currentVideoIndex];
                iframe.src = getEmbedUrl(v.videoUrl);
                title.textContent = v.title;
                prevVideoBtn.style.display = currentVideoIndex === 0 ? 'none' : '';
                nextVideoBtn.style.display = '';
                updateExpandedView();
            });
            nextVideoBtn.addEventListener('click', function() {
                if (currentVideoIndex >= album.videos.length - 1) return;
                currentVideoIndex++;
                var v = album.videos[currentVideoIndex];
                iframe.src = getEmbedUrl(v.videoUrl);
                title.textContent = v.title;
                nextVideoBtn.style.display = currentVideoIndex === album.videos.length - 1 ? 'none' : '';
                prevVideoBtn.style.display = '';
                updateExpandedView();
            });
            header.insertBefore(prevVideoBtn, title);
            header.appendChild(nextVideoBtn);
        }
        header.appendChild(closeBtn);
        
        var iframeWrapper = document.createElement('div');
        iframeWrapper.className = 'video-player-iframe-wrapper';
        
        var iframe = document.createElement('iframe');
        iframe.className = 'video-player-iframe';
        iframe.src = videoUrl;
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
        iframe.setAttribute('frameborder', '0');
        
        // Fullscreen button positioned below video
        var fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'video-player-fullscreen';
        fullscreenBtn.setAttribute('aria-label', 'Enter fullscreen');
        fullscreenBtn.innerHTML = '<img src="playericon/icons8-full-48.png" alt="" class="video-player-fullscreen-icon">';
        
        // Exit fullscreen button (shown when in fullscreen)
        var exitFullscreenBtn = document.createElement('button');
        exitFullscreenBtn.className = 'video-player-exit-fullscreen';
        exitFullscreenBtn.setAttribute('aria-label', 'Exit fullscreen');
        exitFullscreenBtn.innerHTML = '<img src="playericon/icons8-cancel-48.png" alt="" class="video-player-exit-fullscreen-icon">';
        exitFullscreenBtn.style.display = 'none';
        
        fullscreenBtn.addEventListener('click', function() {
            toggleFullscreen(iframeWrapper, iframe, fullscreenBtn, exitFullscreenBtn);
        });
        
        exitFullscreenBtn.addEventListener('click', function() {
            toggleFullscreen(iframeWrapper, iframe, fullscreenBtn, exitFullscreenBtn);
        });
        
        iframeWrapper.appendChild(iframe);
        
        container.appendChild(header);
        container.appendChild(iframeWrapper);
        container.appendChild(fullscreenBtn);
        modal.appendChild(exitFullscreenBtn);
        modal.appendChild(backdrop);
        modal.appendChild(container);
        document.body.appendChild(modal);
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        
        // Close on backdrop click
        backdrop.addEventListener('click', function() {
            closeVideoPlayer();
        });
        
        // Close on Escape key
        function handleEscape(e) {
            if (e.key === 'Escape') {
                closeVideoPlayer();
                document.removeEventListener('keydown', handleEscape);
            }
        }
        document.addEventListener('keydown', handleEscape);
        
        function toggleFullscreen(element, iframeEl, enterBtn, exitBtn) {
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
                // Enter fullscreen
                if (element.requestFullscreen) {
                    element.requestFullscreen();
                } else if (element.webkitRequestFullscreen) {
                    element.webkitRequestFullscreen();
                } else if (element.mozRequestFullScreen) {
                    element.mozRequestFullScreen();
                } else if (element.msRequestFullscreen) {
                    element.msRequestFullscreen();
                }
                
                // Try to lock orientation to landscape (limited browser support)
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(function() {
                        // Orientation lock not supported or failed
                    });
                } else if (screen.lockOrientation) {
                    screen.lockOrientation('landscape');
                } else if (screen.mozLockOrientation) {
                    screen.mozLockOrientation('landscape');
                } else if (screen.msLockOrientation) {
                    screen.msLockOrientation('landscape');
                }
                
                element.classList.add('is-fullscreen');
                header.style.display = 'none';
                enterBtn.style.display = 'none';
                exitBtn.style.display = 'flex';
            } else {
                // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
                
                // Unlock orientation
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                } else if (screen.unlockOrientation) {
                    screen.unlockOrientation();
                } else if (screen.mozUnlockOrientation) {
                    screen.mozUnlockOrientation();
                } else if (screen.msUnlockOrientation) {
                    screen.msUnlockOrientation();
                }
                
                element.classList.remove('is-fullscreen');
                header.style.display = 'flex';
                enterBtn.style.display = 'flex';
                exitBtn.style.display = 'none';
            }
        }
        
        // Listen for fullscreen changes
        function handleFullscreenChange() {
            var isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            if (!isFullscreen) {
                iframeWrapper.classList.remove('is-fullscreen');
                header.style.display = 'flex';
                fullscreenBtn.style.display = 'flex';
                exitFullscreenBtn.style.display = 'none';
                
                // Unlock orientation when exiting fullscreen
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                } else if (screen.unlockOrientation) {
                    screen.unlockOrientation();
                } else if (screen.mozUnlockOrientation) {
                    screen.mozUnlockOrientation();
                } else if (screen.msUnlockOrientation) {
                    screen.msUnlockOrientation();
                }
            }
        }
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        function closeVideoPlayer() {
            // Exit fullscreen if active
            if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
            
            if (modal && modal.parentNode) {
                modal.classList.add('closing');
                setTimeout(function() {
                    if (modal && modal.parentNode) {
                        document.body.removeChild(modal);
                        document.body.style.overflow = '';
                    }
                }, 300);
            }
        }
        
        // Trigger animation
        setTimeout(function() {
            modal.classList.add('is-visible');
        }, 10);
    }

    function viewAlbumContents(album) {
        if (!album) return;
        var hasTracks = album.tracks && album.tracks.length;
        var hasVideos = album.videos && album.videos.length;
        if (!hasTracks && !hasVideos) return;
        expandedAlbum = album;
        updateExpandedView();
        var panel = document.getElementById("mainpage-player-expanded");
        if (panel) {
            panel.setAttribute("data-expanded-mode", "tracklist");
            var isMobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
            if (isMobile) {
                document.body.classList.add("tracklist-view-open");
                document.body.classList.remove("expanded-view-open");
            } else {
                document.body.classList.add("expanded-view-open");
                document.body.classList.remove("tracklist-view-open");
            }
            panel.classList.add("is-visible");
            panel.setAttribute("aria-hidden", "false");
        }
        updatePlayerUI();
    }

    function getDominantColorFromCover(coverPath, callback) {
        if (!coverPath || typeof callback !== "function") return;
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function () {
            try {
                var canvas = document.createElement("canvas");
                var size = 32;
                canvas.width = size;
                canvas.height = size;
                var ctx = canvas.getContext("2d");
                if (!ctx) { callback(48, 48, 65); return; }
                ctx.drawImage(img, 0, 0, size, size);
                var data = ctx.getImageData(0, 0, size, size).data;
                var r = 0, g = 0, b = 0, n = 0;
                for (var i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    n++;
                }
                if (n) {
                    r = Math.round(r / n);
                    g = Math.round(g / n);
                    b = Math.round(b / n);
                    var darken = 0.5;
                    r = Math.round(r * darken + 24 * (1 - darken));
                    g = Math.round(g * darken + 24 * (1 - darken));
                    b = Math.round(b * darken + 40 * (1 - darken));
                } else {
                    r = 48; g = 48; b = 65;
                }
                callback(r, g, b);
            } catch (e) {
                callback(48, 48, 65);
            }
        };
        img.onerror = function () { callback(48, 48, 65); };
        img.src = coverPath;
    }

    function updatePlayerUI() {
        var bar = document.getElementById("mainpage-player");
        var titleEl = document.getElementById("mainpage-player-title");
        if (!bar || !titleEl) return;
        if (currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex]) {
            var t = currentAlbum.tracks[currentTrackIndex];
            titleEl.textContent = currentAlbum.title + " – " + t.title;
            getDominantColorFromCover(currentAlbum.coverPath, function (r, g, b) {
                bar.style.setProperty("--miniplayer-glass-r", String(r));
                bar.style.setProperty("--miniplayer-glass-g", String(g));
                bar.style.setProperty("--miniplayer-glass-b", String(b));
            });
            var wasVisible = bar.classList.contains("is-visible");
            var isMobileTracklist = window.matchMedia && window.matchMedia("(max-width: 768px)").matches
                && document.body.classList.contains("tracklist-view-open");
            if (isMobileTracklist && !wasVisible) {
                bar.classList.remove("is-visible");
                bar.offsetHeight;
                requestAnimationFrame(function () {
                    bar.classList.add("is-visible");
                });
            } else {
                bar.classList.add("is-visible");
            }
        } else {
            bar.classList.remove("is-visible");
            titleEl.textContent = "";
            bar.style.removeProperty("--miniplayer-glass-r");
            bar.style.removeProperty("--miniplayer-glass-g");
            bar.style.removeProperty("--miniplayer-glass-b");
        }
        updatePlayPauseButtons();
        updateExpandedView();
    }

    function updatePlayPauseButtons() {
        var audio = document.getElementById("mainpage-audio");
        var miniPlayImg = document.getElementById("mainpage-player-play-icon-img");
        var miniBtn = document.getElementById("mainpage-player-play");
        var expandedPlayImg = document.getElementById("mainpage-player-expanded-play-icon-img");
        var expandedBtn = document.getElementById("mainpage-player-expanded-play");
        if (!audio) return;
        var isPaused = audio.paused;
        var playSrc = "playericon/icons8-play-48.png";
        var pauseSrc = "playericon/icons8-pause-48.png";
        var playLabel = "Play";
        var pauseLabel = "Pause";
        if (miniPlayImg && miniBtn) {
            miniPlayImg.src = isPaused ? playSrc : pauseSrc;
            miniBtn.setAttribute("aria-label", isPaused ? playLabel : pauseLabel);
        }
        if (expandedPlayImg && expandedBtn) {
            expandedPlayImg.src = isPaused ? playSrc : pauseSrc;
            expandedBtn.setAttribute("aria-label", isPaused ? playLabel : pauseLabel);
        }
    }

    function showToast(message) {
        var el = document.getElementById("mainpage-toast");
        if (!el) return;
        el.textContent = message;
        el.classList.add("is-visible");
        clearTimeout(el._toastTimer);
        el._toastTimer = setTimeout(function () {
            el.classList.remove("is-visible");
        }, 2200);
    }

    function updateLikeButton() {
        var btn = document.getElementById("mainpage-player-expanded-like");
        if (!btn) return;
        var album = expandedAlbum || currentAlbum;
        var show = album && album.tracks && album.tracks.length && album.id;
        if (!show) {
            btn.style.display = "none";
            return;
        }
        btn.style.display = "";
        var effectiveAlbum;
        var effectiveIndex;
        if (album.id === "_favourites") {
            if (currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex] && isTrackFavourited(currentAlbum.id, currentTrackIndex)) {
                effectiveAlbum = currentAlbum;
                effectiveIndex = currentTrackIndex;
            } else {
                var favList = getFavourites();
                if (!favList.length) {
                    btn.style.display = "none";
                    return;
                }
                var first = favList[0];
                effectiveAlbum = data.albums.find(function (a) { return a.id === first.albumId; });
                effectiveIndex = first.trackIndex;
                if (!effectiveAlbum || !effectiveAlbum.tracks || !effectiveAlbum.tracks[effectiveIndex]) {
                    btn.style.display = "none";
                    return;
                }
            }
        } else {
            effectiveAlbum = currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex] && (currentAlbum === album || currentAlbum.id === album.id)
                ? currentAlbum
                : album;
            effectiveIndex = (effectiveAlbum === currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex]) ? currentTrackIndex : 0;
            if (!effectiveAlbum.tracks[effectiveIndex]) effectiveIndex = 0;
        }
        var saved = isTrackFavourited(effectiveAlbum.id, effectiveIndex);
        btn.classList.toggle("is-saved", saved);
        btn.setAttribute("aria-label", saved ? "Remove from Favourites" : "Save to Favourites");
        btn.title = saved ? "Remove from Favourites" : "Save to Favourites";
        btn.setAttribute("data-album-id", effectiveAlbum.id);
        btn.setAttribute("data-track-index", String(effectiveIndex));
    }

    function updateExpandedView() {
        var panel = document.getElementById("mainpage-player-expanded");
        var coverImg = document.getElementById("mainpage-player-expanded-cover-img");
        var blurEl = document.getElementById("mainpage-player-expanded-blur");
        var titleEl = document.getElementById("mainpage-player-expanded-album-title");
        var metaEl = document.getElementById("mainpage-player-expanded-meta");
        var listEl = document.getElementById("mainpage-player-tracklist");
        if (!panel || !listEl) return;

        var album = expandedAlbum || currentAlbum;
        if (!album) {
            if (coverImg) { coverImg.src = ""; coverImg.alt = ""; }
            if (blurEl) blurEl.style.backgroundImage = "";
            if (titleEl) titleEl.textContent = "";
            if (metaEl) metaEl.textContent = "";
            var trackTitleEl = document.getElementById("mainpage-player-expanded-track-title");
            var trackMetaEl = document.getElementById("mainpage-player-expanded-track-meta");
            if (trackTitleEl) trackTitleEl.textContent = "";
            if (trackMetaEl) trackMetaEl.textContent = "";
            listEl.innerHTML = "";
            var p = document.getElementById("mainpage-player-expanded");
            if (p) p.classList.remove("is-video-folder");
            return;
        }
        var hasTracks = album.tracks && album.tracks.length;
        var hasVideos = album.videos && album.videos.length;
        if (!hasTracks && !hasVideos) {
            if (coverImg) { coverImg.src = ""; coverImg.alt = ""; }
            if (blurEl) blurEl.style.backgroundImage = "";
            if (titleEl) titleEl.textContent = "";
            if (metaEl) metaEl.textContent = "";
            var trackTitleEl = document.getElementById("mainpage-player-expanded-track-title");
            var trackMetaEl = document.getElementById("mainpage-player-expanded-track-meta");
            if (trackTitleEl) trackTitleEl.textContent = "";
            if (trackMetaEl) trackMetaEl.textContent = "";
            listEl.innerHTML = "";
            var p = document.getElementById("mainpage-player-expanded");
            if (p) p.classList.remove("is-video-folder");
            return;
        }

        var nowPlayingAlbum = (currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex])
            ? currentAlbum
            : album;
        if (coverImg) {
            coverImg.src = nowPlayingAlbum.coverPath;
            coverImg.alt = nowPlayingAlbum.title;
        }
        if (blurEl) {
            blurEl.style.backgroundImage = "url(" + nowPlayingAlbum.coverPath + ")";
        }
        if (titleEl) titleEl.textContent = album.title;
        if (metaEl) metaEl.textContent = hasVideos
            ? (album.videos.length + " video" + (album.videos.length !== 1 ? "s" : ""))
            : (album.tracks.length + " track" + (album.tracks.length !== 1 ? "s" : ""));
        var trackTitleEl = document.getElementById("mainpage-player-expanded-track-title");
        var trackMetaEl = document.getElementById("mainpage-player-expanded-track-meta");
        if (trackTitleEl) {
            if (hasVideos) {
                trackTitleEl.textContent = (currentVideoAlbum === album && album.videos[currentVideoIndex])
                    ? album.videos[currentVideoIndex].title
                    : (album.videos[0] ? album.videos[0].title : "");
            } else if (currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex])
                trackTitleEl.textContent = currentAlbum.tracks[currentTrackIndex].title;
            else if (album.tracks[0])
                trackTitleEl.textContent = album.tracks[0].title;
            else
                trackTitleEl.textContent = "";
        }
        if (trackMetaEl) {
            trackMetaEl.textContent = nowPlayingAlbum.title;
        }
        if (hasVideos) {
            var likeBtn = document.getElementById("mainpage-player-expanded-like");
            if (likeBtn) likeBtn.style.display = "none";
        } else {
            updateLikeButton();
        }
        var panelEl = document.getElementById("mainpage-player-expanded");
        if (panelEl) {
            if (hasVideos) panelEl.classList.add("is-video-folder");
            else panelEl.classList.remove("is-video-folder");
        }
        listEl.innerHTML = "";
        if (hasVideos) {
            album.videos.forEach(function (v, i) {
                var li = document.createElement("li");
                if (currentVideoAlbum === album && currentVideoIndex === i) li.classList.add("is-current");
                var thumb = document.createElement("img");
                thumb.className = "track-list-cover";
                thumb.src = (v.coverPath || album.coverPath);
                thumb.alt = "";
                thumb.loading = "lazy";
                var numSpan = document.createElement("span");
                numSpan.className = "track-num";
                numSpan.textContent = i + 1;
                var btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = v.title;
                btn.addEventListener("click", function () { openVideoPlayer(album, i); });
                li.appendChild(thumb);
                li.appendChild(numSpan);
                li.appendChild(btn);
                listEl.appendChild(li);
            });
            return;
        }
        var currentTrackInExpanded = -1;
        if (album.id === "_favourites" && currentAlbum) {
            for (var j = 0; j < album.tracks.length; j++) {
                if (album.tracks[j].albumId === currentAlbum.id && album.tracks[j].trackIndex === currentTrackIndex) {
                    currentTrackInExpanded = j;
                    break;
                }
            }
        } else if (currentAlbum === album) {
            currentTrackInExpanded = currentTrackIndex;
        }
        album.tracks.forEach(function (track, i) {
            var li = document.createElement("li");
            if (i === currentTrackInExpanded) li.classList.add("is-current");
            var thumb = document.createElement("img");
            thumb.className = "track-list-cover";
            thumb.src = album.id === "_favourites" && track.coverPath ? track.coverPath : album.coverPath;
            thumb.alt = "";
            thumb.loading = "lazy";
            var numSpan = document.createElement("span");
            numSpan.className = "track-num";
            numSpan.textContent = i + 1;
            var btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = track.title;
            btn.addEventListener("click", function () { playTrackAtIndex(i); });
            li.appendChild(thumb);
            li.appendChild(numSpan);
            li.appendChild(btn);
            listEl.appendChild(li);
        });
    }

    function playTrackAtIndex(index) {
        var album = expandedAlbum || currentAlbum;
        if (!album || !album.tracks || !album.tracks[index]) return;
        if (album.id === "_favourites") {
            var favTrack = album.tracks[index];
            var realAlbum = data.albums.find(function (a) { return a.id === favTrack.albumId; });
            if (!realAlbum || !realAlbum.tracks[favTrack.trackIndex]) return;
            currentAlbum = realAlbum;
            currentTrackIndex = favTrack.trackIndex;
            var track = realAlbum.tracks[favTrack.trackIndex];
            var audio = document.getElementById("mainpage-audio");
            if (audio) {
                audio.src = track.audioPath;
                audio.play().catch(function () {});
            }
            updatePlayerUI();
            return;
        }
        currentAlbum = album;
        currentTrackIndex = index;
        var track = album.tracks[index];
        var audio = document.getElementById("mainpage-audio");
        if (audio) {
            audio.src = track.audioPath;
            audio.play().catch(function () {});
        }
        updatePlayerUI();
    }

    function getNextTrackIndex() {
        if (!currentAlbum || !currentAlbum.tracks.length) return 0;
        var len = currentAlbum.tracks.length;
        if (shuffleEnabled) return Math.floor(Math.random() * len);
        return (currentTrackIndex + 1) % len;
    }

    function getPrevTrackIndex() {
        if (!currentAlbum || !currentAlbum.tracks.length) return 0;
        var len = currentAlbum.tracks.length;
        if (shuffleEnabled) return Math.floor(Math.random() * len);
        return (currentTrackIndex - 1 + len) % len;
    }

    function advanceToNextTrack() {
        if (!currentAlbum || !currentAlbum.tracks.length) return;
        var audio = document.getElementById("mainpage-audio");
        if (!audio) return;
        var nextIndex = getNextTrackIndex();
        currentTrackIndex = nextIndex;
        audio.src = currentAlbum.tracks[nextIndex].audioPath;
        audio.play().catch(function () {});
        updatePlayerUI();
    }

    function advanceToPrevTrack() {
        if (!currentAlbum || !currentAlbum.tracks.length) return;
        var audio = document.getElementById("mainpage-audio");
        if (!audio) return;
        var prevIndex = getPrevTrackIndex();
        currentTrackIndex = prevIndex;
        audio.src = currentAlbum.tracks[prevIndex].audioPath;
        audio.play().catch(function () {});
        updatePlayerUI();
    }

    function getVolumeIconPath(volumePct) {
        var pct = Math.min(100, Math.max(0, Math.round(volumePct)));
        if (pct === 0) return "playericon/icons8-speaker-48.png";
        if (pct <= 33) return "playericon/icons8-speaker-48 (1).png";
        if (pct <= 66) return "playericon/icons8-speaker-48 (2).png";
        return "playericon/icons8-speaker-48 (3).png";
    }

    function updateVolumeIcon(volumePct) {
        var img = document.getElementById("mainpage-player-volume-icon-img");
        if (!img) return;
        var newPath = getVolumeIconPath(volumePct);
        if (img.src && img.src.length > 0) {
            img.style.opacity = "0.4";
            requestAnimationFrame(function () {
                img.src = newPath;
                requestAnimationFrame(function () {
                    img.style.opacity = "1";
                });
            });
        } else {
            img.src = newPath;
        }
    }

    function updateShuffleRepeatUI() {
        var shuffleBtn = document.getElementById("mainpage-player-shuffle");
        var repeatBtn = document.getElementById("mainpage-player-repeat");
        var repeatImg = document.getElementById("mainpage-player-repeat-icon-img");
        if (shuffleBtn) {
            shuffleBtn.classList.toggle("is-active", shuffleEnabled);
            shuffleBtn.setAttribute("aria-label", shuffleEnabled ? "Shuffle on" : "Shuffle");
        }
        if (repeatBtn) {
            repeatBtn.classList.toggle("is-active", repeatMode !== "none");
            repeatBtn.setAttribute("aria-label", repeatMode === "one" ? "Repeat one" : repeatMode === "all" ? "Repeat all" : "Repeat");
        }
        if (repeatImg) {
            repeatImg.src = repeatMode === "one" ? "playericon/icons8-repeat-one-48.png" : "playericon/icons8-repeat-48.png";
        }
    }

    function initExpandedPlayer() {
        var expandBtn = document.getElementById("mainpage-player-expand");
        var closeBtn = document.getElementById("mainpage-player-expanded-close");
        var panel = document.getElementById("mainpage-player-expanded");
        var playerBar = document.getElementById("mainpage-player");
        var expandedPlay = document.getElementById("mainpage-player-expanded-play");
        var audio = document.getElementById("mainpage-audio");

        if (expandBtn && panel) {
            expandBtn.addEventListener("click", function () {
                expandedAlbum = currentAlbum || expandedAlbum;
                panel.removeAttribute("data-expanded-mode");
                document.body.classList.add("expanded-view-open");
                document.body.classList.remove("tracklist-view-open");
                panel.classList.add("is-visible");
                panel.setAttribute("aria-hidden", "false");
                updateExpandedView();
            });
        }
        if (playerBar && panel) {
            playerBar.addEventListener("click", function (e) {
                if (!window.matchMedia || !window.matchMedia("(max-width: 768px)").matches) return;
                if (e.target.closest(".mainpage-player-play-btn")) return;
                panel.setAttribute("data-expanded-mode", "nowplaying");
                document.body.classList.add("expanded-view-open");
                document.body.classList.remove("tracklist-view-open");
                panel.classList.add("is-visible");
                panel.setAttribute("aria-hidden", "false");
                updateExpandedView();
            });
        }
        if (closeBtn && panel) {
            closeBtn.addEventListener("click", function () {
                panel.classList.remove("is-visible");
                panel.setAttribute("aria-hidden", "true");
                document.body.classList.remove("expanded-view-open");
                document.body.classList.remove("tracklist-view-open");
            });
        }
        panel.addEventListener("click", function (e) {
            if (e.target === panel) {
                panel.classList.remove("is-visible");
                panel.setAttribute("aria-hidden", "true");
                document.body.classList.remove("expanded-view-open");
                document.body.classList.remove("tracklist-view-open");
            }
        });
        if (expandedPlay && audio) {
            expandedPlay.addEventListener("click", function () {
                if (audio.paused) {
                    if (currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex]) {
                        if (!audio.src) {
                            audio.src = currentAlbum.tracks[currentTrackIndex].audioPath;
                        }
                    }
                    audio.play().catch(function () {});
                } else {
                    audio.pause();
                }
                updatePlayPauseButtons();
            });
        }
        var playAllBtn = document.getElementById("mainpage-player-expanded-play-all");
        if (playAllBtn) {
            playAllBtn.addEventListener("click", function () {
                var album = expandedAlbum || currentAlbum;
                if (album && album.tracks && album.tracks.length) playAlbum(album);
                else if (album && album.videos && album.videos.length) openVideoPlayer(album, 0);
            });
        }
        var likeBtn = document.getElementById("mainpage-player-expanded-like");
        if (likeBtn) {
            likeBtn.addEventListener("click", function () {
                var albumId = likeBtn.getAttribute("data-album-id");
                var trackIndex = parseInt(likeBtn.getAttribute("data-track-index"), 10);
                if (!albumId || isNaN(trackIndex)) return;
                if (isTrackFavourited(albumId, trackIndex)) {
                    removeFromFavourites(albumId, trackIndex);
                    showToast("Removed from favourites");
                } else {
                    addToFavourites(albumId, trackIndex);
                    showToast("Added to favourite");
                }
                updateLikeButton();
                renderGrid();
                updateExpandedView();
            });
        }
        var expandedPrev = document.getElementById("mainpage-player-expanded-prev");
        var expandedNext = document.getElementById("mainpage-player-expanded-next");
        var expandedSeek = document.getElementById("mainpage-player-expanded-seek");
        var expandedCurrent = document.getElementById("mainpage-player-expanded-current");
        var expandedDuration = document.getElementById("mainpage-player-expanded-duration");
        var expandedVolume = document.getElementById("mainpage-player-expanded-volume");
        if (expandedPrev && audio) {
            expandedPrev.addEventListener("click", function () {
                if (!currentAlbum || !currentAlbum.tracks.length) return;
                if (audio.currentTime > 2) {
                    audio.currentTime = 0;
                } else {
                    advanceToPrevTrack();
                }
            });
        }
        if (expandedNext && audio) {
            expandedNext.addEventListener("click", function () {
                if (!currentAlbum || !currentAlbum.tracks.length) return;
                advanceToNextTrack();
            });
        }
        if (expandedSeek && audio) {
            expandedSeek.addEventListener("input", function () {
                var pct = parseFloat(expandedSeek.value, 10) / 100;
                audio.currentTime = pct * (audio.duration || 0);
            });
        }
        if (expandedVolume && audio) {
            expandedVolume.addEventListener("input", function () {
                var pct = parseFloat(expandedVolume.value, 10);
                audio.volume = pct / 100;
                updateVolumeIcon(pct);
            });
            expandedVolume.value = Math.round((audio.volume || 1) * 100);
            updateVolumeIcon(parseFloat(expandedVolume.value, 10));
        }
        var shuffleBtn = document.getElementById("mainpage-player-shuffle");
        var repeatBtn = document.getElementById("mainpage-player-repeat");
        if (panel) {
            panel.addEventListener("click", function (e) {
                if (e.target.closest("#mainpage-player-repeat")) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (repeatMode === "none") repeatMode = "all";
                    else if (repeatMode === "all") repeatMode = "one";
                    else repeatMode = "none";
                    updateShuffleRepeatUI();
                    return;
                }
                if (e.target.closest("#mainpage-player-shuffle")) {
                    e.preventDefault();
                    e.stopPropagation();
                    shuffleEnabled = !shuffleEnabled;
                    updateShuffleRepeatUI();
                    return;
                }
            });
        }
        updateShuffleRepeatUI();
    }

    function renderAlbumCard(album, isLpMv) {
        var card = document.createElement("div");
        card.className = "album-card";

        var cover = document.createElement("img");
        cover.className = "album-card-cover";
        cover.src = album.coverPath;
        cover.alt = album.title;
        cover.loading = "lazy";
        cover.onerror = function () { this.style.display = "none"; };

        var overlay = document.createElement("div");
        overlay.className = "album-card-overlay";

        var title = document.createElement("span");
        title.className = "album-card-title";
        title.textContent = album.title;

        if (isLpMv && (album.videoUrl || (album.videos && album.videos.length))) {
            card.classList.add("has-video");
            var playBtn = document.createElement("button");
            playBtn.type = "button";
            playBtn.className = "album-card-play album-card-play-corner";
            playBtn.setAttribute("aria-label", "Watch " + album.title);
            var playIcon = document.createElement("img");
            playIcon.className = "album-card-play-icon";
            playIcon.src = "playericon/icons8-play-48.png";
            playIcon.alt = "";
            playIcon.setAttribute("aria-hidden", "true");
            playBtn.appendChild(playIcon);
            playBtn.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (album.videos && album.videos.length) {
                    viewAlbumContents(album);
                } else {
                    openVideoPlayer(album);
                }
            });
            overlay.appendChild(title);
            overlay.appendChild(playBtn);
            card.addEventListener("click", function(e) {
                if (e.target.closest(".album-card-play")) return;
                if (album.videos && album.videos.length) viewAlbumContents(album);
            });
            overlay.style.cursor = "pointer";
        } else if (album.tracks && album.tracks.length) {
            card.classList.add("has-tracks");
            overlay.addEventListener("click", function (e) {
                if (e.target.closest(".album-card-play")) return;
                viewAlbumContents(album);
            });
            overlay.style.cursor = "pointer";
            var playBtn = document.createElement("button");
            playBtn.type = "button";
            playBtn.className = "album-card-play album-card-play-corner";
            playBtn.setAttribute("aria-label", "Play " + album.title);
            var playIcon = document.createElement("img");
            playIcon.className = "album-card-play-icon";
            playIcon.src = "playericon/icons8-play-48.png";
            playIcon.alt = "";
            playIcon.setAttribute("aria-hidden", "true");
            playBtn.appendChild(playIcon);
            playBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                playAlbum(album);
            });
            overlay.appendChild(title);
            overlay.appendChild(playBtn);
        } else {
            overlay.appendChild(title);
        }

        card.appendChild(cover);
        card.appendChild(overlay);
        return card;
    }

    function renderSearchTrackRow(entry) {
        var row = document.createElement("div");
        row.className = "mainpage-search-result-row";
        var thumb = document.createElement("img");
        thumb.className = "mainpage-search-result-cover";
        thumb.src = entry.album.coverPath;
        thumb.alt = "";
        thumb.loading = "lazy";
        var info = document.createElement("div");
        info.className = "mainpage-search-result-info";
        var titleEl = document.createElement("span");
        titleEl.className = "mainpage-search-result-title";
        titleEl.textContent = entry.track.title;
        var metaEl = document.createElement("span");
        metaEl.className = "mainpage-search-result-meta";
        metaEl.textContent = entry.album.title;
        info.appendChild(titleEl);
        info.appendChild(metaEl);
        var playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "mainpage-search-result-play";
        playBtn.setAttribute("aria-label", "Play " + entry.track.title);
        var playIcon = document.createElement("img");
        playIcon.src = "playericon/icons8-play-48.png";
        playIcon.alt = "";
        playIcon.className = "mainpage-search-result-play-icon";
        playBtn.appendChild(playIcon);
        row.appendChild(thumb);
        row.appendChild(info);
        row.appendChild(playBtn);
        function playThis() {
            currentAlbum = entry.album;
            currentTrackIndex = entry.trackIndex;
            expandedAlbum = entry.album;
            var audio = document.getElementById("mainpage-audio");
            if (audio) {
                audio.src = entry.track.audioPath;
                audio.play().catch(function () {});
            }
            updatePlayerUI();
        }
        row.addEventListener("click", function (e) {
            if (e.target.closest(".mainpage-search-result-play")) return;
            playThis();
        });
        playBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            playThis();
        });
        return row;
    }

    function renderGrid() {
        var query = searchEl ? searchEl.value : "";
        var queryTrimmed = query ? query.trim() : "";
        if (currentView === "unrlsd" && queryTrimmed) {
            var matchingTracks = getMatchingTracks(queryTrimmed);
            gridEl.innerHTML = "";
            gridEl.classList.remove("covers-grid");
            gridEl.classList.add("mainpage-search-results");
            if (matchingTracks.length === 0) {
                gridEl.innerHTML = "<p class=\"mainpage-error\">No tracks found for \"" + queryTrimmed + "\".</p>";
                return;
            }
            matchingTracks.forEach(function (entry) {
                gridEl.appendChild(renderSearchTrackRow(entry));
            });
            return;
        }
        gridEl.classList.remove("mainpage-search-results");
        gridEl.classList.add("covers-grid");
        var items = currentView === "unrlsd" ? data.albums : data.lpsMvs;
        if (currentView === "unrlsd") {
            var favAlbum = getFavouritesAlbum();
            if (favAlbum) items = [favAlbum].concat(items);
        }
        items = filterBySearch(items, query);

        gridEl.innerHTML = "";
        if (currentView === "lpsmvs" && items.length === 0) {
            gridEl.innerHTML = "<p class=\"mainpage-error\">No LPs & MVs yet. Add entries to <code>lpsMvs</code> in <code>data/albums.json</code>.</p>";
            return;
        }
        items.forEach(function (item) {
            gridEl.appendChild(renderAlbumCard(item, currentView === "lpsmvs"));
        });
    }

    function initPlayer() {
        var audio = document.getElementById("mainpage-audio");
        if (audio) {
            audio.addEventListener("ended", function () {
                if (!currentAlbum || !currentAlbum.tracks.length) return;
                var len = currentAlbum.tracks.length;
                if (repeatMode === "one") {
                    audio.currentTime = 0;
                    audio.play().catch(function () {});
                    return;
                }
                var nextIndex = getNextTrackIndex();
                if (repeatMode === "none" && currentTrackIndex === len - 1) {
                    currentTrackIndex = 0;
                    updatePlayerUI();
                    return;
                }
                currentTrackIndex = nextIndex;
                audio.src = currentAlbum.tracks[nextIndex].audioPath;
                audio.play().catch(function () {});
                updatePlayerUI();
            });
        }
        initMiniPlayerControls();
    }

    function formatTime(seconds) {
        if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
        var m = Math.floor(seconds / 60);
        var s = Math.floor(seconds % 60);
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function initMiniPlayerControls() {
        var audio = document.getElementById("mainpage-audio");
        var playBtn = document.getElementById("mainpage-player-play");
        var prevBtn = document.getElementById("mainpage-player-prev");
        var nextBtn = document.getElementById("mainpage-player-next");
        var seekEl = document.getElementById("mainpage-player-seek");
        var currentEl = document.getElementById("mainpage-player-current");
        var durationEl = document.getElementById("mainpage-player-duration");
        if (!audio) return;

        if (playBtn) {
            playBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                if (audio.paused) {
                    if (currentAlbum && currentAlbum.tracks && currentAlbum.tracks[currentTrackIndex]) {
                        if (!audio.src) {
                            audio.src = currentAlbum.tracks[currentTrackIndex].audioPath;
                        }
                    }
                    audio.play().catch(function () {});
                } else {
                    audio.pause();
                }
                updatePlayPauseButtons();
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener("click", function () {
                if (!currentAlbum || !currentAlbum.tracks.length) return;
                if (audio.currentTime > 2) {
                    audio.currentTime = 0;
                } else {
                    advanceToPrevTrack();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener("click", function () {
                if (!currentAlbum || !currentAlbum.tracks.length) return;
                advanceToNextTrack();
            });
        }
        if (seekEl) {
            seekEl.addEventListener("input", function () {
                var pct = parseFloat(seekEl.value, 10) / 100;
                audio.currentTime = pct * (audio.duration || 0);
            });
        }
        audio.addEventListener("timeupdate", function () {
            if (currentEl) currentEl.textContent = formatTime(audio.currentTime);
            if (seekEl && audio.duration && isFinite(audio.duration)) {
                seekEl.value = Math.round((audio.currentTime / audio.duration) * 100);
            }
            var expandedCurrentEl = document.getElementById("mainpage-player-expanded-current");
            var expandedSeekEl = document.getElementById("mainpage-player-expanded-seek");
            if (expandedCurrentEl) expandedCurrentEl.textContent = formatTime(audio.currentTime);
            if (expandedSeekEl && audio.duration && isFinite(audio.duration)) {
                expandedSeekEl.value = Math.round((audio.currentTime / audio.duration) * 100);
            }
        });
        audio.addEventListener("loadedmetadata", function () {
            if (durationEl) durationEl.textContent = formatTime(audio.duration);
            var expandedDurationEl = document.getElementById("mainpage-player-expanded-duration");
            if (expandedDurationEl) expandedDurationEl.textContent = formatTime(audio.duration);
        });
        audio.addEventListener("durationchange", function () {
            if (durationEl) durationEl.textContent = formatTime(audio.duration);
            var expandedDurationEl = document.getElementById("mainpage-player-expanded-duration");
            if (expandedDurationEl) expandedDurationEl.textContent = formatTime(audio.duration);
        });
        audio.addEventListener("play", updatePlayPauseButtons);
        audio.addEventListener("pause", updatePlayPauseButtons);
    }

    function initSearch() {
        if (searchEl) {
            searchEl.addEventListener("input", function () { renderGrid(); });
            searchEl.addEventListener("change", function () { renderGrid(); });
        }
    }

    loadData()
        .then(function () {
            initSidebar();
            renderGrid();
            initPlayer();
            initExpandedPlayer();
            initSearch();
        })
        .catch(function () {
            gridEl.innerHTML = "<p class=\"mainpage-error\">Could not load albums. Add <code>data/albums.json</code> and serve the site (e.g. with a local server).</p>";
        });
})();

