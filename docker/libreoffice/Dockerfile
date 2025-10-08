# LibreOffice Headless Service for DOCX/HTML Conversion
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install LibreOffice and dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-java-common \
    default-jre \
    fonts-liberation \
    fonts-dejavu \
    fonts-noto \
    curl \
    python3 \
    python3-pip \
    python3-uno \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for UNO bridge
RUN pip3 install flask requests

# Create app directory
WORKDIR /app

# Copy conversion service
COPY conversion-service.py /app/
COPY templates/ /app/templates/

# Create directories for file processing
RUN mkdir -p /app/input /app/output /app/temp

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the conversion service
CMD ["python3", "conversion-service.py"]
