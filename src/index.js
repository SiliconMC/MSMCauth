/**
 * MSMCauth (Microsoft account authentication for Minecraft)
 * Makes logging into Minecraft via a Microsoft account easier.
 * Released to Public Domain on 25/10/21 by JH (jacksta), lead developer of SiliconMC.
 * https://github.com/SiliconMC/MSMCauth/
 * 
 */

const axios = require("axios")
const opener = require("opener")
const promptSync = require('prompt-sync')
const fs = require('fs')
const os = require('os')
const path = require('path')

let microsoftURL
let token
const desktop = path.join(os.homedir(), "Desktop")
const prompt = promptSync()

// Uncomment and insert your Azure auth URL in between the left quotes. More info here: https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app
//microsoftURL = ``

process.title = "Log in to Minecraft using your Microsoft account"
console.log("Log in to Minecraft using your Microsoft account\n")

if (microsoftURL) {
    opener(microsoftURL)
    console.log("Opening your browser now...")
    token = prompt("Enter your authentication code: ")

    if(!token) {
        console.error("\nYou need to enter your authentication code.\n")
        exit()
        return
        
    }
    console.clear()
    authXBL()
} else {
    console.clear()
    console.error("You need to set the OAuth endpoint to continue.\n")
    exit();
}

function authXBL() {
    axios({
            method: 'post',
            url: 'https://user.auth.xboxlive.com/user/authenticate',
            data: {
                Properties: {
                    AuthMethod: "RPS",
                    SiteName: "user.auth.xboxlive.com",
                    RpsTicket: "d=" + token
                },
                RelyingParty: "http://auth.xboxlive.com",
                TokenType: "JWT"
            },
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        }).then(response => {
            console.log("Successfully authenticated with XBL.")
            authXSTS(response.data.Token, response.data.DisplayClaims.xui[0].uhs)
        })
        .catch(err => {
            console.log(err)
            console.error("\nError signing in to XBL. You may have pasted the incorrect code. Try again and make sure you the correct code.\n")
            exit()
        })
}

function authXSTS(xblAuthCode, userHash) {
    axios({
            method: 'post',
            url: 'https://xsts.auth.xboxlive.com/xsts/authorize',
            data: {
                Properties: {
                    SandboxId: "RETAIL",
                    UserTokens: [
                        xblAuthCode
                    ]
                },
                RelyingParty: "rp://api.minecraftservices.com/",
                TokenType: "JWT"
            },
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        }).then(response => {
            console.log("Successfully authenticated with XSTS.")
            authMinecraft(response.data.Token, userHash)
        })
        .catch(err => {
            console.log(err.data)
            console.error("\nError signing in to XSTS. This could be because you don't have a Xbox account, you can not proceed.")
            console.error("More infomation here: https://wiki.vg/Microsoft_Authentication_Scheme#Authenticate_with_XSTS\n")
            exit()
        })
}

function authMinecraft(xstsAuthToken, userHash) {
    axios({
            method: 'post',
            url: 'https://api.minecraftservices.com/authentication/login_with_xbox',
            data: {
                "identityToken": `XBL3.0 x=${userHash};${xstsAuthToken}`
            },
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        }).then(response => {
            console.log("Almost there! Successfully authenticated with Minecraft.")
            getProfile(response.data.access_token)
        })
        .catch(err => {
            console.error(err.data)
            console.log("\nError signing in to Minecraft. You may not own Minecraft, however this is still rare. Close this window and try again.\n")
            exit()
        })
}

/**
 * NOTE: We don't check for game ownership since the getProfile()
 * won't succeed without it.
 * 
 */

function getProfile(bearerToken) {
    axios({
            method: 'get',
            url: 'https://api.minecraftservices.com/minecraft/profile',
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${bearerToken}`,
            },

            // Proxy configurable for Fiddler, useful for mocking migrated accounts w/o owning one.
            // proxy: {
            //    host: '127.0.0.1',
            //    port: 8888,
            // }

        }).then(response => {
            let json = JSON.stringify({
                clientToken: "null",
                accessToken: bearerToken,
                selectedProfile: {
                    name: response.data.name,
                    id: response.data.id.split('-').join('')
                }
            })

            fs.writeFileSync(desktop + "microsoft_account.json", json)
            console.clear()
            console.log(`Welcome back, ${response.data.name}. Here is your Minecraft access token,\n`)
            console.log(`${bearerToken}`)
            console.log(`\nWe have also saved a JSON file containing your credentials to your Desktop, this can be used with Minecraft and other launchers.\n`)
            exit()

        })
        .catch(err => {
            console.error(err)
            console.log("\nError getting your Minecraft profile. You most likely you do not own the game.")
            console.log("Close this window and try again.\n")
            exit()
        })
}


function exit() {
    console.log("MSMCauth v1.0.0 by JH (jacksta), lead developer of SiliconMC")
    console.log("Compile your own version of MSMCauth at https://github.com/SiliconMC/MSMCauth/\n")
    console.log('Press any key to exit.')
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', process.exit.bind(process, 0))
}