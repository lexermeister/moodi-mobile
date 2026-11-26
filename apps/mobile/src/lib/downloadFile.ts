// Browser-only utility; imported exclusively by .web modules.
export function downloadFile(uri: string, fileName: string) {
  const link = document.createElement('a');
  link.href = uri;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}
