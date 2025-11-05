// src/content/main.ts

// Content script for video detection and overlay management

interface VideoElement {
  element: HTMLVideoElement;
  id: string;
  timestamp: number;
}

interface OverlayElement {
  id: string;
  element: HTMLElement;
  videoId: string;
  position: { x: number; y: number };
  visible: boolean;
}

class VideoTranslationOverlay {
  private videos: Map<string, VideoElement> = new Map();
  private overlays: Map<string, OverlayElement> = new Map();
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private observer?: MutationObserver;
  
  constructor() {
    this.initialize();
  }
  
  private async initialize() {
    console.log('[AK-HD-Video] Initializing video translation overlay');
    
    // Set up communication with background script
    this.setupMessageHandling();
    
    // Scan for existing videos
    this.scanForVideos();
    
    // Set up mutation observer to detect new videos
    this.setupMutationObserver();
    
    // Send initialization message to background
    this.sendMessage('CONTENT_SCRIPT_READY', { 
      url: window.location.href,
      videosFound: this.videos.size
    });
  }
  
  private setupMessageHandling() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
    
    // Handle messages from popup
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      const { type, data } = event.data;
      this.handlePopupMessage(type, data);
    });
  }
  
  private handleMessage(message: any, sender: any, sendResponse: any) {
    const { type, data } = message;
    
    switch (type) {
      case 'CREATE_VIDEO_OVERLAY':
        this.createOverlay(data.videoId, data.position);
        sendResponse({ success: true });
        break;
        
      case 'REMOVE_VIDEO_OVERLAY':
        this.removeOverlay(data.videoId);
        sendResponse({ success: true });
        break;
        
      case 'UPDATE_OVERLAY_POSITION':
        this.updateOverlayPosition(data.videoId, data.position);
        sendResponse({ success: true });
        break;
        
      case 'SHOW_TRANSLATION':
        this.showTranslation(data.videoId, data.translation);
        sendResponse({ success: true });
        break;
        
      case 'HIDE_TRANSLATION':
        this.hideTranslation(data.videoId);
        sendResponse({ success: true });
        break;
        
      case 'GET_VIDEO_INFO':
        const videoInfo = this.getVideoInfo(data.videoId);
        sendResponse({ success: true, data: videoInfo });
        break;
        
      case 'SCAN_VIDEOS':
        const videos = this.getAllVideos();
        sendResponse({ success: true, data: videos });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Keep message channel open
  }
  
  private handlePopupMessage(type: string, data: any) {
    switch (type) {
      case 'POPUP_READY':
        console.log('[AK-HD-Video] Popup is ready');
        break;
        
      case 'SHOW_POPUP_HELP':
        this.showHelpTooltip();
        break;
    }
  }
  
  private scanForVideos() {
    const videoElements = document.querySelectorAll('video');
    console.log(`[AK-HD-Video] Found ${videoElements.length} video elements`);
    
    videoElements.forEach((video, index) => {
      this.registerVideo(video, `video_${index}_${Date.now()}`);
    });
  }
  
  private setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      let hasNewVideos = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Check if the added node is a video
              if (element.tagName === 'VIDEO') {
                this.registerVideo(element as HTMLVideoElement, `video_${Date.now()}`);
                hasNewVideos = true;
              }
              
              // Check for videos in added containers
              const videos = element.querySelectorAll?.('video');
              if (videos && videos.length > 0) {
                videos.forEach((video, index) => {
                  this.registerVideo(video, `video_${Date.now()}_${index}`);
                });
                hasNewVideos = true;
              }
            }
          });
        }
      });
      
      if (hasNewVideos) {
        this.sendMessage('VIDEOS_UPDATED', { videosFound: this.videos.size });
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  private registerVideo(video: HTMLVideoElement, id: string) {
    if (this.videos.has(id)) return;
    
    const videoElement: VideoElement = {
      element: video,
      id,
      timestamp: Date.now()
    };
    
    this.videos.set(id, videoElement);
    
    // Set up event listeners for the video
    this.setupVideoEventListeners(videoElement);
    
    console.log(`[AK-HD-Video] Registered video: ${id}`);
  }
  
  private setupVideoEventListeners(video: VideoElement) {
    const { element } = video;
    
    element.addEventListener('loadstart', () => {
      console.log(`[AK-HD-Video] Video ${video.id} load started`);
    });
    
    element.addEventListener('canplay', () => {
      console.log(`[AK-HD-Video] Video ${video.id} can play`);
      this.sendMessage('VIDEO_READY', { videoId: video.id });
    });
    
    element.addEventListener('play', () => {
      console.log(`[AK-HD-Video] Video ${video.id} started playing`);
      this.sendMessage('VIDEO_PLAYING', { videoId: video.id });
    });
    
    element.addEventListener('pause', () => {
      console.log(`[AK-HD-Video] Video ${video.id} paused`);
    });
    
    element.addEventListener('ended', () => {
      console.log(`[AK-HD-Video] Video ${video.id} ended`);
    });
  }
  
  private createOverlay(videoId: string, position: { x: number; y: number }) {
    const video = this.videos.get(videoId);
    if (!video) {
      console.warn(`[AK-HD-Video] Video ${videoId} not found`);
      return;
    }
    
    // Remove existing overlay
    this.removeOverlay(videoId);
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = `ak-hd-overlay-${videoId}`;
    overlay.className = 'ak-hd-video-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: ${position.y}px;
      left: ${position.x}px;
      z-index: 9999;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Create control button
    const button = document.createElement('button');
    button.className = 'ak-hd-control-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M6 6l6 6M18 6l-6 6M12 18v4"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
    button.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    `;
    
    // Add hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    
    // Add click handler
    button.addEventListener('click', () => {
      this.sendMessage('OVERLAY_CLICKED', { videoId });
    });
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'ak-hd-tooltip';
    tooltip.textContent = 'ترجمة فورية للفيديو';
    tooltip.style.cssText = `
      position: absolute;
      bottom: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    button.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
    });
    
    button.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    // Assemble overlay
    overlay.appendChild(button);
    overlay.appendChild(tooltip);
    
    // Position overlay relative to video
    video.element.parentElement?.appendChild(overlay);
    
    // Make overlay follow video position
    this.makeOverlayFollowVideo(video, overlay);
    
    // Store overlay reference
    const overlayElement: OverlayElement = {
      id: `overlay-${videoId}`,
      element: overlay,
      videoId,
      position,
      visible: true
    };
    
    this.overlays.set(videoId, overlayElement);
    
    console.log(`[AK-HD-Video] Created overlay for video ${videoId}`);
  }
  
  private removeOverlay(videoId: string) {
    const overlay = this.overlays.get(videoId);
    if (overlay) {
      overlay.element.remove();
      this.overlays.delete(videoId);
      console.log(`[AK-HD-Video] Removed overlay for video ${videoId}`);
    }
  }
  
  private updateOverlayPosition(videoId: string, position: { x: number; y: number }) {
    const overlay = this.overlays.get(videoId);
    if (overlay) {
      overlay.position = position;
      overlay.element.style.top = `${position.y}px`;
      overlay.element.style.left = `${position.x}px`;
    }
  }
  
  private showTranslation(videoId: string, translation: any) {
    const overlay = this.overlays.get(videoId);
    if (!overlay) return;
    
    // Create or update translation display
    let translationDisplay = overlay.element.querySelector('.ak-hd-translation') as HTMLElement;
    
    if (!translationDisplay) {
      translationDisplay = document.createElement('div');
      translationDisplay.className = 'ak-hd-translation';
      translationDisplay.style.cssText = `
        position: absolute;
        top: -60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        max-width: 300px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        display: none;
        z-index: 10000;
      `;
      overlay.element.appendChild(translationDisplay);
    }
    
    translationDisplay.textContent = translation.text || '...';
    translationDisplay.style.display = 'block';
    
    // Auto-hide after delay
    setTimeout(() => {
      translationDisplay.style.display = 'none';
    }, 5000);
  }
  
  private hideTranslation(videoId: string) {
    const overlay = this.overlays.get(videoId);
    if (!overlay) return;
    
    const translationDisplay = overlay.element.querySelector('.ak-hd-translation') as HTMLElement;
    if (translationDisplay) {
      translationDisplay.style.display = 'none';
    }
  }
  
  private makeOverlayFollowVideo(video: VideoElement, overlay: HTMLElement) {
    // Ensure overlay follows video position and size
    const updateOverlayPosition = () => {
      const rect = video.element.getBoundingClientRect();
      const parentRect = video.element.parentElement?.getBoundingClientRect();
      
      if (parentRect) {
        overlay.style.position = 'absolute';
        overlay.style.top = `${rect.top - parentRect.top + 20}px`;
        overlay.style.left = `${rect.right - parentRect.left - 60}px`;
      }
    };
    
    // Update position initially
    updateOverlayPosition();
    
    // Update on scroll and resize
    window.addEventListener('scroll', updateOverlayPosition);
    window.addEventListener('resize', updateOverlayPosition);
    
    // Update when video metadata loads
    video.element.addEventListener('loadedmetadata', updateOverlayPosition);
  }
  
  private getVideoInfo(videoId: string) {
    const video = this.videos.get(videoId);
    if (!video) return null;
    
    const element = video.element;
    
    return {
      id: videoId,
      src: element.currentSrc || element.src,
      duration: element.duration,
      currentTime: element.currentTime,
      paused: element.paused,
      ended: element.ended,
      volume: element.volume,
      muted: element.muted,
      playbackRate: element.playbackRate,
      readyState: element.readyState,
      networkState: element.networkState
    };
  }
  
  private getAllVideos() {
    return Array.from(this.videos.values()).map(video => ({
      id: video.id,
      src: video.element.currentSrc || video.element.src,
      duration: video.element.duration,
      readyState: video.element.readyState
    }));
  }
  
  private showHelpTooltip() {
    const helpTooltip = document.createElement('div');
    helpTooltip.className = 'ak-hd-help-tooltip';
    helpTooltip.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        max-width: 400px;
      ">
        <h3>مرحباً بك في AK-HD Translated Video!</h3>
        <p>اضغط على أيقونة الترجمة على الفيديو لبدء الترجمة الفورية.</p>
        <button onclick="this.parentElement.parentElement.remove()" style="
          margin-top: 10px;
          padding: 8px 16px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">حسناً</button>
      </div>
    `;
    
    document.body.appendChild(helpTooltip);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (helpTooltip.parentElement) {
        helpTooltip.remove();
      }
    }, 10000);
  }
  
  private sendMessage(type: string, data: any) {
    chrome.runtime.sendMessage({ type, data }).catch(error => {
      console.warn(`[AK-HD-Video] Failed to send message ${type}:`, error);
    });
  }
  
  // Cleanup method
  destroy() {
    this.observer?.disconnect();
    this.videos.clear();
    this.overlays.clear();
    
    // Remove all overlays from DOM
    document.querySelectorAll('.ak-hd-video-overlay').forEach(el => el.remove());
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VideoTranslationOverlay();
  });
} else {
  new VideoTranslationOverlay();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  // Cleanup will be handled by the class destructor
});

export { VideoTranslationOverlay };