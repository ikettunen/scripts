# AWS CLI Commands for S3 Bucket Verification

This document contains AWS CLI commands used to verify and manage our S3 bucket for the nursing home application.

## Bucket Information

- **Bucket Name**: `nursing-home-audio-recordings-20251124`
- **Region**: `eu-north-1`

## List Files in Bucket

### List all files with details (size, date)
```bash
aws s3 ls s3://nursing-home-audio-recordings-20251124/ --recursive --human-readable --region eu-north-1
```

### List files in audio_recordings folder
```bash
aws s3 ls s3://nursing-home-audio-recordings-20251124/audio_recordings/ --recursive --human-readable --region eu-north-1
```

### List files in photos folder
```bash
aws s3 ls s3://nursing-home-audio-recordings-20251124/photos/ --recursive --human-readable --region eu-north-1
```

### List files for specific visit ID
```bash
aws s3 ls s3://nursing-home-audio-recordings-20251124/audio_recordings/988481d6-0a01-4601-94bc-c61e59dc8208/ --human-readable --region eu-north-1
aws s3 ls s3://nursing-home-audio-recordings-20251124/photos/988481d6-0a01-4601-94bc-c61e59dc8208/ --human-readable --region eu-north-1
```

## Download Files

### Download a specific audio file
```bash
aws s3 cp s3://nursing-home-audio-recordings-20251124/audio_recordings/988481d6-0a01-4601-94bc-c61e59dc8208/visit_audio_20251204_200020.wav ./downloaded_audio.wav --region eu-north-1
```

### Download a specific photo
```bash
aws s3 cp s3://nursing-home-audio-recordings-20251124/photos/988481d6-0a01-4601-94bc-c61e59dc8208/visit_photo_20251204_204304.jpg ./downloaded_photo.jpg --region eu-north-1
```

### Download entire visit folder (all files for a visit)
```bash
aws s3 cp s3://nursing-home-audio-recordings-20251124/audio_recordings/988481d6-0a01-4601-94bc-c61e59dc8208/ ./visit_files/ --recursive --region eu-north-1
```

## Upload Files (for testing)

### Upload a test audio file
```bash
aws s3 cp ./test_audio.wav s3://nursing-home-audio-recordings-20251124/audio_recordings/test/test_audio.wav --region eu-north-1
```

### Upload a test photo
```bash
aws s3 cp ./test_photo.jpg s3://nursing-home-audio-recordings-20251124/photos/test/test_photo.jpg --region eu-north-1
```

## Delete Files

### Delete a specific file
```bash
aws s3 rm s3://nursing-home-audio-recordings-20251124/audio_recordings/test/test_audio.wav --region eu-north-1
```

### Delete all files in a folder (careful!)
```bash
aws s3 rm s3://nursing-home-audio-recordings-20251124/audio_recordings/test/ --recursive --region eu-north-1
```

## Bucket Information

### Get bucket location
```bash
aws s3api get-bucket-location --bucket nursing-home-audio-recordings-20251124
```

### Get bucket size and file count
```bash
aws s3 ls s3://nursing-home-audio-recordings-20251124/ --recursive --summarize --human-readable --region eu-north-1
```

## Troubleshooting

### Check if file exists
```bash
aws s3 ls s3://nursing-home-audio-recordings-20251124/photos/988481d6-0a01-4601-94bc-c61e59dc8208/visit_photo_20251204_204304.jpg --region eu-north-1
```

### Get file metadata
```bash
aws s3api head-object --bucket nursing-home-audio-recordings-20251124 --key photos/988481d6-0a01-4601-94bc-c61e59dc8208/visit_photo_20251204_204304.jpg --region eu-north-1
```

## Notes

- Always specify `--region eu-north-1` to avoid region mismatch issues
- Use `--human-readable` flag for easier-to-read file sizes
- Use `--recursive` flag to operate on all files in a folder
- The bucket structure:
  - `audio_recordings/{visitId}/{filename}.wav`
  - `photos/{visitId}/{filename}.jpg`
