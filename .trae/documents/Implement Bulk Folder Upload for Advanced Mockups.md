I will implement a **Floating Upload Manager** that allows you to start multiple uploads and let them run in the background while you continue working.

### **The New Workflow**
1.  **Start Upload 1**: You click "Upload" on "iPhone 13", select files, and hit "Start".
2.  **Dialog Closes**: The dialog immediately disappears, and a **Floating Progress Panel** appears in the bottom-right corner showing "iPhone 13: Uploading...".
3.  **Start Upload 2**: You immediately click "Upload" on "Samsung S24", select files, and hit "Start".
4.  **Parallel Processing**: Both uploads run simultaneously. The progress panel lists both tasks with individual progress bars.
5.  **Control**: You can cancel any specific upload from the panel if needed.

### **Technical Implementation (`src/pages/admin/mockups-advanced.tsx`)**

1.  **Create `UploadManager` System**:
    *   I will move the upload logic out of the modal and into a background processor.
    *   It will manage a list of `activeUploads`.

2.  **New Component: `UploadProgressPanel`**:
    *   A fixed panel (bottom-right) that stays visible even when you scroll or interact with other models.
    *   Displays a row for each active upload: `[Model Name] [Progress Bar] [Stats (Success/Skip/Fail)] [Cancel Button]`.
    *   Automatically dismisses completed uploads after a delay or manual close.

3.  **Update `UploadMockupsDialog`**:
    *   It will now purely be a "File Selector".
    *   Clicking "Upload" simply queues the task and closes the modal, freeing you to select the next model immediately.

This gives you the "seamless" capability to queue up 4-5 models manually and monitor them all at once.
