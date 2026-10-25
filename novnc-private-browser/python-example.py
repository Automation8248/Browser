"""
Host machine par chalayein, container ke Chromium se connect hone ke liye.
Zaroorat: pip install selenium
"""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# Container ka bridge kiya hua CDP address
CDP_ADDRESS = "127.0.0.1:9223"

chrome_options = Options()
chrome_options.add_experimental_option("debuggerAddress", CDP_ADDRESS)

driver = webdriver.Chrome(options=chrome_options)

# Example: current page title dekhein
print("Current title:", driver.title)

# Example: naya tab kholein aur navigate karein
driver.execute_script("window.open('https://www.google.com', '_blank');")
driver.switch_to.window(driver.window_handles[-1])
print("New tab title:", driver.title)

# Note: driver.quit() na call karein, warna container ka browser band ho jayega
